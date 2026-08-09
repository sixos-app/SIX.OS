# SIX.OS Beta Exit Criteria

O Beta não será lançado sob nenhuma circunstância até que os seguintes critérios técnicos e de negócios sejam incontestavelmente comprovados:

## 1. Segurança Zero-Trust
Nenhuma API pode confiar implicitamente em payloads injetados pelo cliente para assumir identidade ou organização. Toda a identidade será chancelada e criptograficamente protegida pela validação JWT no Trust Boundary ou pelo cookie de sessão (Secure/HttpOnly).

## 2. Autonomia do Banco de Dados
A infraestrutura será provida por D1 Databases isolados. O ambiente de Beta utilizará um D1 Database completamente apartado do ambiente Dev, com seeds populados unicamente por dados administrativos estritos. O backup estará ativo e haverá pelo menos um ensaio de restore bem sucedido.

## 3. Isolamento RBAC e Multi-Tenant (Cross-Org)
Os testes de certificação (`npm run certify:beta`) devem atestar pass-rate 100% nas defesas contra exploração vertical (privilégio expandido) e isolamento horizontal (Cross-Org).

## 4. UI/UX Limiar
Não deve existir tela sem um *empty state*, sem *loading indicator* (durante fetches visíveis), ou que perca responsividade a 320px de largura de forma catastrófica (overflows não intencionais que impedem o uso). A funcionalidade de "Report Bug/Feedback" deve estar unificada no shell do app.

## 5. Legislação & Confidencialidade
A estrutura deve estar formalmente capaz de deletar (soft) registros inativos, mascarar informações não divulgáveis (`results_available_at`) e respeitar perfeitamente o escopo visual de comitês/departamentos (`department`, `team`, `own`).

Ao final do `BR-6`, o comando unificado de teste emitirá a assinatura criptográfica ou hash que testifica o estado limpo do repositório antes do Merge Final para Deploy de Beta Fechado.
