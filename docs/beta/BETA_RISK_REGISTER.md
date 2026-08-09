# SIX.OS Beta Risk Register

Este documento monitora riscos de segurança, operacionais e arquiteturais conhecidos no projeto que poderiam obstruir o lançamento Beta (Go-Live).

| ID | Description | Severity | Impact | Mitigation | Status | Blocking? |
|---|---|---|---|---|---|---|
| R-001 | Header Spoofing via `Cf-Access-Authenticated-User-Email` | CRITICAL | Acesso não autorizado se contornado proxy (Cloudflare) | Injetar barreira JWT validada pelo backend em Prod | MITIGATED | Yes |
| R-002 | Retenção Destrutiva de Histórico (ON DELETE CASCADE) | HIGH | Perda de PDI/Debrief ao deletar usuários | Migration `0021` aplicada (ON DELETE NO ACTION) | MITIGATED | Yes |
| R-003 | Sessões com Tempo Indeterminado | MEDIUM | Cookie takeover ou uso prolongado s/ validação | BR-1: Definir validade, refresh tokens ou revogação | MITIGATED | Yes |
| R-004 | Ausência de CSRF e Política CORS flexível | HIGH | Cross-Site Request Forgery via sessões browser | BR-1: Adicionar headers rígidos e validação Origin | MITIGATED | Yes |
| R-005 | Vazamento de Dados Sensíveis via Logs (PII) | HIGH | Ferimento da LGPD / logs do workers c/ senhas ou tokens | BR-1: Auditar middlewares e purgar payloads sensíveis | MITIGATED | Yes |
| R-006 | DB Único Misturando Desenvolvimento e Beta | CRITICAL | Sujeira / Corrupção de dados Beta | BR-3: Criar Binding exclusivo p/ Beta DB | OPEN | Yes |
