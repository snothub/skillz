{{/*
Expand the name of the chart.
*/}}
{{- define "mcpcoder.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mcpcoder.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mcpcoder.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "mcpcoder.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mcpcoder.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mcpcoder.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Auth verifier fullname
*/}}
{{- define "mcpcoder.authFullname" -}}
{{- printf "%s-auth" (include "mcpcoder.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Auth verifier selector labels
*/}}
{{- define "mcpcoder.authSelectorLabels" -}}
app.kubernetes.io/name: {{ include "mcpcoder.name" . }}-auth
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
