# Modelos para Importação de Dados em Massa - EducaLota

Este documento descreve a estrutura das planilhas (.xlsx) aceitas para importação de dados no sistema.

> **Importante:** A primeira linha de cada planilha deve conter exatamente os cabeçalhos listados abaixo.

---

## 1. Planilha de Escolas (`escolas.xlsx`)
Utilizada para cadastrar novas unidades escolares.

| Coluna | Obrigatório | Tipo | Exemplo | Observações |
| :--- | :---: | :--- | :--- | :--- |
| **Nome da Escola** | Sim | Texto | E.M. Monteiro Lobato | Deve ser único no sistema. |
| **Região** | Sim | Texto | Urbano | Opções: "Urbano" ou "Campo". |
| **Diretor** | Não | Texto | João Silva | Nome completo do diretor. |
| **Vice-Diretor** | Não | Texto | Maria Oliveira | Nome completo do vice. |
| **Descrição** | Não | Texto | Escola com rampa | Detalhes sobre acessibilidade, etc. |

---

## 2. Planilha de Profissionais (`servidores.xlsx`)
Utilizada para cadastrar a equipe técnica e de apoio.

| Coluna | Obrigatório | Tipo | Exemplo | Observações |
| :--- | :---: | :--- | :--- | :--- |
| **Nome Completo** | Sim | Texto | Ana Paula Souza | |
| **Matrícula** | Sim | Texto (Numérico) | 123456 | Identificador único do servidor. |
| **Cargo** | Sim | Texto | Professor AEE | Opções: "Professor AEE", "Intérprete", "Apoio", "Psicólogo". |
| **Vínculo** | Sim | Texto | Efetivo | Opções: "Efetivo", "Contrato", "Municipalizado". |
| **Carga Horária (Total)** | Sim | Número | 200 | Apenas números (horas). |
| **Carga Horária (Disp.)** | Sim | Número | 150 | Horas livres para alocação. |

---

## 3. Planilha de Estudantes (`estudantes.xlsx`)
Utilizada para cadastrar alunos e, opcionalmente, já vinculá-los a escolas.

| Coluna | Obrigatório | Tipo | Exemplo | Observações |
| :--- | :---: | :--- | :--- | :--- |
| **Nome do Estudante** | Sim | Texto | Pedro Santos | |
| **Idade** | Sim | Número | 10 | |
| **Escola Atual** | Não | Texto | E.M. Monteiro Lobato | O nome deve ser IDÊNTICO ao cadastrado no sistema. Se não encontrar, o aluno ficará "Sem Escola". |
| **Série/Turma** | Não | Texto | 5º Ano B | Apenas informativo se a turma não existir criada. |
| **CID** | Não | Texto | F84.0 | Código da doença/condição. |
| **Grupo Especial** | Não | Texto | TEA | Ex: "TEA", "Def. Física", "Surdez". |
| **Necessidades** | Não | Texto | Mediador, Cuidador | Separar múltiplos itens por vírgula. |
| **Observações** | Não | Texto | Aluno utiliza cadeira de rodas | |

---

## Regras de Processamento (Para Desenvolvedores)

1.  **Validação:** O sistema deve verificar nomes duplicados antes de salvar.
2.  **Vínculo Inteligente:** Na importação de estudantes, o sistema deve buscar o `school_id` comparando o texto da coluna "Escola Atual" com o banco de dados (Case Insensitive).
3.  **Parsers:**
    *   `Necessidades`: Fazer um `split(',')` da string para transformar em Array no banco.
    *   `Região`: Converter para "Standard" (ex: "urbano" -> "Urbano").
