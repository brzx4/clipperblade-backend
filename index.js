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

const converterValor = (valor) => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const valorNormalizado = valor.replace(',', '.');
    const n = Number(valorNormalizado);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

// Criação das tabelas
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
        status TEXT DEFAULT 'pendente',
        valor NUMERIC DEFAULT 0
      );
    `);
    console.log("Tabela 'agendamentos' criada/verificada.");
  } catch (err) {
    console.error('Erro ao criar/verificar tabelas:', err);
  }
})();

// Rotas existentes
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

app.get('/agendamentos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, cliente_nome, telefone, data, hora, servico, status, valor::float AS valor
      FROM agendamentos
      ORDER BY data, hora
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
  }
});

app.post('/agendamentos', async (req, res) => {
  const { cliente_nome, telefone, data, hora, servico, status, valor } = req.body;

  if (!cliente_nome || !telefone || !data || !hora || !servico) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios!' });
  }

  try {
    const conflito = await pool.query(
      'SELECT id FROM agendamentos WHERE data = $1 AND hora = $2',
      [data, hora]
    );
    if (conflito.rows.length > 0) {
      return res.status(400).json({ error: 'Horário já ocupado.' });
    }

    const valorNumerico = converterValor(valor);

    await pool.query(
      'INSERT INTO agendamentos (cliente_nome, telefone, data, hora, servico, status, valor) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [cliente_nome, telefone, data, hora, servico, status || 'pendente', valorNumerico]
    );
    res.status(201).json({ message: 'Agendamento criado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar agendamento.' });
  }
});

app.put('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { cliente_nome, telefone, data, hora, servico, status, valor } = req.body;

  if (!cliente_nome || !telefone || !data || !hora || !servico || !status) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios!' });
  }

  try {
    const conflito = await pool.query(
      'SELECT id FROM agendamentos WHERE data = $1 AND hora = $2 AND id <> $3',
      [data, hora, id]
    );

    if (conflito.rows.length > 0) {
      return res.status(400).json({ error: 'Horário já ocupado por outro agendamento.' });
    }

    const valorNumerico = converterValor(valor);

    const result = await pool.query(
      'UPDATE agendamentos SET cliente_nome=$1, telefone=$2, data=$3, hora=$4, servico=$5, status=$6, valor=$7 WHERE id=$8 RETURNING *',
      [cliente_nome, telefone, data, hora, servico, status, valorNumerico, id]
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

// Novas rotas de estatísticas
app.get('/estatisticas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='concluido') AS atendimentos,
        COALESCE(SUM(valor) FILTER (WHERE status='concluido'),0) AS receita
      FROM agendamentos
    `);

    const { rows: servicoRows } = await pool.query(`
      SELECT servico, COUNT(*) AS total
      FROM agendamentos
      WHERE status='concluido'
      GROUP BY servico
      ORDER BY total DESC
      LIMIT 1
    `);

    const { rows: clienteRows } = await pool.query(`
      SELECT cliente_nome, COUNT(*) AS total
      FROM agendamentos
      WHERE status='concluido'
      GROUP BY cliente_nome
      ORDER BY total DESC
      LIMIT 1
    `);

    res.json({
      atendimentos: Number(rows[0].atendimentos),
      receita: Number(rows[0].receita),
      servico_mais_fez: servicoRows[0]?.servico || '-',
      cliente_mais_frequente: clienteRows[0]?.cliente_nome || '-'
    });
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

app.get('/estatisticas/:periodo', async (req, res) => {
  const { periodo } = req.params;
  try {
    let whereClause = "status='concluido'";
    const hoje = new Date();
    
    if (periodo === 'DIA') {
      whereClause += ` AND data = '${hoje.toISOString().split('T')[0]}'`;
    } else if (periodo === 'SEMANA') {
      const primeiroDia = new Date();
      primeiroDia.setDate(hoje.getDate() - hoje.getDay());
      const ultimoDia = new Date(primeiroDia);
      ultimoDia.setDate(primeiroDia.getDate() + 6);
      whereClause += ` AND data BETWEEN '${primeiroDia.toISOString().split('T')[0]}' AND '${ultimoDia.toISOString().split('T')[0]}'`;
    } else if (periodo === 'MES') {
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();
      whereClause += ` AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}`;
    } else {
      return res.status(400).json({ error: 'Período inválido' });
    }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS atendimentos,
        COALESCE(SUM(valor),0) AS receita
      FROM agendamentos
      WHERE ${whereClause}
    `);

    res.json({
      atendimentos: Number(rows[0].atendimentos),
      receita: Number(rows[0].receita)
    });
  } catch (err) {
    console.error('Erro ao buscar estatísticas por período:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'API rodando!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
