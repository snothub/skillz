// src/skills-server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

const SKILLS_DIR = process.env.SKILLS_DIR ?? path.join(process.cwd(), ".claude/skills");
const PORT = parseInt(process.env.PORT ?? "3000", 10);

interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
}

function loadSkills(): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  if (!fs.existsSync(SKILLS_DIR)) return skills;
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;
    const content = fs.readFileSync(skillMdPath, "utf-8");
    skills.set(entry.name, { name: entry.name, description: extractDescription(content), content, path: skillMdPath });
  }
  return skills;
}

function extractDescription(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const descMatch = match[1].match(/^description:\s*(.+)$/m);
    if (descMatch) return descMatch[1].trim();
  }
  for (const line of markdown.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && !t.startsWith("---")) return t.slice(0, 200);
  }
  return "No description available";
}

let skills = loadSkills();

// Fresh McpServer per request — the SDK disallows reusing a single instance
// across multiple concurrent transports.
function createServer(): McpServer {
  const server = new McpServer({ name: "skills-server", version: "1.0.0" });

  server.tool("list_skills", "List all available skills with their descriptions", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify(Array.from(skills.values()).map(s => ({ name: s.name, description: s.description })), null, 2) }],
  }));

  server.tool("search_skills", "Search skills by keyword in name or description",
    { query: z.string().describe("Keyword to search for") },
    async ({ query }) => {
      const q = query.toLowerCase();
      const matches = Array.from(skills.values()).filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
      return { content: [{ type: "text", text: matches.length === 0 ? `No skills found matching "${query}"` : JSON.stringify(matches.map(s => ({ name: s.name, description: s.description })), null, 2) }] };
    }
  );

  server.tool("get_skill", "Read the full SKILL.md content for a specific skill",
    { name: z.string().describe("Skill folder name (e.g. 'docx', 'code-review')") },
    async ({ name }) => {
      const skill = skills.get(name);
      if (!skill) return { content: [{ type: "text", text: `Skill "${name}" not found.` }], isError: true };
      return { content: [{ type: "text", text: skill.content }] };
    }
  );

  server.tool("reload_skills", "Reload all skills from disk", {}, async () => {
    skills = loadSkills();
    return { content: [{ type: "text", text: `Reloaded ${skills.size} skills.` }] };
  });

  server.resource("skill", new ResourceTemplate("skill://{name}", { list: undefined }), async (uri, { name }) => {
    const skill = skills.get(name as string);
    if (!skill) throw new Error(`Skill "${name}" not found`);
    return { contents: [{ uri: uri.href, text: skill.content, mimeType: "text/markdown" }] };
  });

  return server;
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", skills: skills.size }));
    return;
  }

  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcpServer = createServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`Skills MCP server listening on port ${PORT}`);
  console.log(`Skills loaded: ${skills.size} from ${SKILLS_DIR}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health:       http://localhost:${PORT}/health`);
});