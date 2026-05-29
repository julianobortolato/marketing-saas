# QA — smoke-onboarding-fixes
> Sprint: smoke-onboarding-fixes | SHA: 9204260 | Data: 2026-05-29

## Passo 3 — Upload de logo
| # | Cenário | Ação | Esperado |
|---|---|---|---|
| 1 | Logo real PNG <2MB | Subir no drop zone | Miniatura + swatches de cores aparecem |
| 2 | Clicar em swatch | Selecionar cor | Swatch destacado + botão Confirmar ativo |
| 3 | Arquivo >2MB | Tentar upload | Erro de tamanho |
| 4 | Paleta vazia | Upload de screenshot | "Selecione a cor primária" sem swatches |

## Passo 4 — Identidade da marca
| # | Cenário | Ação | Esperado |
|---|---|---|---|
| 5 | Tom de voz | Clicar opção | Destacado, sem "Required" |
| 6 | Público-alvo | Digitar texto | Aceita sem "Required" |
| 7 | Diferencial | Digitar texto | Aceita sem "Required" |
| 8 | Frequência | Clicar opção | Destacado, sem "Required" |
| 9 | Submeter sem público-alvo | Deixar vazio + Confirmar | "Required" aparece no campo |
| 10 | Frequencia inválida no banco | Recarregar passo | Não crasha, fallback 3x_semana |

## Passo 1 — Cadastro
| # | Cenário | Ação | Esperado |
|---|---|---|---|
| 11 | nome_dono vazio | Tentar avançar | Erro visível no campo |
| 12 | Tudo preenchido | Confirmar | Avança para passo 2 |
