# SIX.OS Beta Risk Register

Este documento monitora riscos de segurança, operacionais e arquiteturais conhecidos no projeto que poderiam obstruir o lançamento Beta (Go-Live).

| ID | Description | Severity | Impact | Mitigation | Status | Blocking? |
|---|---|---|---|---|---|---|
| R-001 | Header Spoofing via `Cf-Access-Authenticated-User-Email` | CRITICAL | Acesso não autorizado se contornado proxy (Cloudflare) | JWT validado e e-mail vinculado ao claim assinado; falta validar após deploy | MITIGATED IN CODE | Yes |
| R-002 | Retenção Destrutiva de Histórico (ON DELETE CASCADE) | CRITICAL | Perda silenciosa de dados filhos durante upgrade | Migration `0021` reescrita e teste populado automatizado; falta auditar histórico remoto | MITIGATED IN CODE | Yes |
| R-003 | Sessões com Tempo Indeterminado | MEDIUM | Cookie takeover ou uso prolongado s/ validação | BR-1: Definir validade, refresh tokens ou revogação | MITIGATED | Yes |
| R-004 | Ausência de CSRF e Política CORS flexível | HIGH | Cross-Site Request Forgery via sessões browser | Comparação de origem exata e regressão automatizada | MITIGATED IN CODE | Yes |
| R-005 | Vazamento de Dados Sensíveis via Logs (PII) | HIGH | Ferimento da LGPD / logs do workers c/ senhas ou tokens | BR-1: Auditar middlewares e purgar payloads sensíveis | MITIGATED | Yes |
| R-006 | DB Único Misturando Desenvolvimento e Beta | CRITICAL | Sujeira / Corrupção de dados Beta | BR-3: Criar Binding exclusivo p/ Beta DB | OPEN | Yes |
| R-007 | Segredos de integração em plaintext ou cruzados entre organizações | CRITICAL | Vazamento de token/webhook e sobrescrita cross-tenant | AES-GCM, chave externa e `UNIQUE(organization_id, provider)` | MITIGATED IN CODE | Yes |
| R-008 | Ausência de CI e restore testado | HIGH | Regressão ou recuperação inviável após deploy | Implementar pipeline e exercício de restore em BR-3 | OPEN | Yes |
