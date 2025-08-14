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

// Rotas existentes (cadastro, login, CRUD agendamentos) permanecem intactas
// ...

// Rotas de estatísticas
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
