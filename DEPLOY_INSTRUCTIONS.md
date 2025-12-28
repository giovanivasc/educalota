# Guia de Deploy na Vercel - EducaLota

Este projeto já está configurado para ser implantado na **Vercel** de forma simples. Siga os passos abaixo:

## Pré-requisitos

1.  Ter uma conta na [Vercel](https://vercel.com).
2.  Ter o código do projeto em um repositório Git (GitHub, GitLab ou Bitbucket).

## Passos para Deploy

1.  **Importar Projeto:**
    *   No painel da Vercel, clique em **"Add New..."** > **"Project"**.
    *   Selecione o repositório onde este código está hospedado.

2.  **Configuração de Build (Automática):**
    *   Framework Preset: **Vite** (A Vercel deve detectar automaticamente).
    *   Root Directory: Certifique-se de selecionar a pasta **`educalota`** (onde está o `package.json`), caso o repositório tenha múltiplas pastas. Se o `package.json` estiver na raiz, ignore isso.
    *   Build Command: `npm run build` (ou `vite build`).
    *   Output Directory: `dist`.

3.  **Variáveis de Ambiente (Environment Variables):**
    Expandir a seção "Environment Variables" e adicionar as seguintes chaves (baseado no seu Supabase):

    | Nome da Chave | Valor (Exemplo) | Descrição |
    | :--- | :--- | :--- |
    | `VITE_SUPABASE_URL` | `https://sua-url-do-projeto.supabase.co` | URL do seu projeto Supabase |
    | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1...` | Chave pública (anon) do Supabase |
    | `GEMINI_API_KEY` | `AIzaSy...` | (Opcional) Se estiver usando funcionalidades de IA |

    *Você pode encontrar esses valores no seu arquivo `.env` local ou no Dashboard do Supabase em Project Settings > API.*

4.  **Confirmar e Deploy:**
    *   Clique em **"Deploy"**.
    *   Aguarde alguns segundos/minutos.
    *   Seu projeto estará online em `https://seu-projeto.vercel.app`.

## Observações

*   O projeto usa **TailwindCSS via CDN**, então não requer passo de build de CSS complexo.
*   O roteamento utiliza (`HashRouter`), o que é compatível com qualquer hospedagem estática sem configurações extras de servidor.
*   Se ocorrerem erros de permissão no banco, certifique-se de que os scripts SQL de correção (`corrigir_permissoes_banco.sql`) foram rodados no Supabase.
