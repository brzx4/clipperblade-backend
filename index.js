import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false }
});

// ====== Criação das tabelas ======
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario TEXT UNIQUE NOT NULL,
        telefone TEXT NOT NULL,
        senha TEXT NOT NULL
      );
    `);
    console.log("Tabela 'usuarios' criada/verificada.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        cliente_nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        data DATE NOT NULL,
        hora TIME NOT NULL,
        servico TEXT NOT NULL,
        status TEXT DEFAULT 'pendente'
      );
    `);
    console.log("Tabela 'agendamentos' criada/verificada.");
  } catch (err) {
    console.error('Erro ao criar/verificar tabelas:', err);
  }
})();

// ====== Rotas de Cadastro ======
app.post('/cadastro', async (req, res) => {
  const { usuario, telefone, senha } = req.body;
  if (!usuario || !telefone || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos!' });
  }
  try {
    const exists = await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
    }
    await pool.query(
      'INSERT INTO usuarios (usuario, telefone, senha) VALUES ($1, $2, $3)',
      [usuario, telefone, senha]
    );
    res.json({ message: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar os dados.' });
  }
});

// ====== Rota de Login ======
app.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos!' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE (usuario = $1 OR telefone = $1) AND senha = $2',
      [login, senha]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    res.json({ message: 'Login realizado com sucesso!' });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro no servidor durante o login.' });
  }
});

// ====== Rotas de Agendamentos ======

// Listar todos os agendamentos
app.get('/agendamentos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM agendamentos ORDER BY data, hora');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
  }
});

// Criar um agendamento (com validação de horário)
app.post('/agendamentos', async (req, res) => {
  const { cliente_nome, telefone, data, hora, servico, status } = req.body;

  if (!cliente_nome || !telefone || !data || !hora || !servico) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios!' });
  }

  try {
    // Verificar se já existe agendamento para data+hora
    const conflito = await pool.query(
      'SELECT id FROM agendamentos WHERE data = $1 AND hora = $2',
      [data, hora]
    );
    if (conflito.rows.length > 0) {
      return res.status(400).json({ error: 'Horário já ocupado.' });
    }

    await pool.query(
      'INSERT INTO agendamentos (cliente_nome, telefone, data, hora, servico, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [cliente_nome, telefone, data, hora, servico, status || 'pendente']
    );
    res.status(201).json({ message: 'Agendamento criado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar agendamento.' });
  }
});

// Atualizar um agendamento (com validação de horário, exceto o próprio)
app.put('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { cliente_nome, telefone, data, hora, servico, status } = req.body;

  if (!cliente_nome || !telefone || !data || !hora || !servico || !status) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios!' });
  }

  try {
    // Verificar se já existe outro agendamento com mesma data e hora, diferente deste id
    const conflito = await pool.query(
      'SELECT id FROM agendamentos WHERE data = $1 AND hora = $2 AND id <> $3',
      [data, hora, id]
    );

    if (conflito.rows.length > 0) {
      return res.status(400).json({ error: 'Horário já ocupado por outro agendamento.' });
    }

    const result = await pool.query(
      'UPDATE agendamentos SET cliente_nome=$1, telefone=$2, data=$3, hora=$4, servico=$5, status=$6 WHERE id=$7 RETURNING *',
      [cliente_nome, telefone, data, hora, servico, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.json({ message: 'Agendamento atualizado com sucesso!', agendamento: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
  }
});

// Deletar um agendamento
app.delete('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM agendamentos WHERE id=$1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.json({ message: 'Agendamento excluído com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir agendamento.' });
  }
});

// Marcar agendamento como concluído
app.patch('/agendamentos/:id/concluir', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE agendamentos SET status = 'concluido' WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao concluir agendamento:', error);
    res.status(500).json({ error: 'Erro ao concluir agendamento.' });
  }
});

// Rota raiz para teste simples
app.get('/', (req, res) => {
  res.json({ message: 'API rodando!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
