import express from 'express';
import pg from 'pg';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  user: 'clipperblade_user',
  host: 'dpg-d2djv7ogjchc73drcep0-a',
  database: 'clipperblade',
  password: 'zUt0FfXuDCSfOkPcgPYkwDc8dmYEJlU8',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT UNIQUE NOT NULL,
      telefone TEXT NOT NULL,
      senha TEXT NOT NULL
    );
  `);
  console.log("Tabela 'usuarios' criada/verificada.");
})();

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

    await pool.query('INSERT INTO usuarios (usuario, telefone, senha) VALUES ($1, $2, $3)', [usuario, telefone, senha]);

    res.json({ message: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar os dados.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
