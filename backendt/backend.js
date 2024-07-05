const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Conectar a SQLite
const db = new sqlite3.Database('./mydatabase.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Crear tabla de usuarios
db.run(`CREAR TABLA SI NO EXISTE usuario(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  mascota TEXT
  gmail TEXT UNIQUE,
  password INTEGER,
)`);

// Ruta de registro
app.post('/register', async (req, res) => {
  const { nombre, mascota, gmail, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `INSERT INTO users (nombre, mascota, gmail, password) VALUES (?, ?, ?, ?)`;
  db.run(sql, [ nombre, mascota, gmail, hashedPassword], function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ id: this.lastID, nombre, mascota, gmail });
  });
});

// Ruta de inicio de sesión
app.post('/login', (req, res) => {
  const { gmail, password } = req.body;

  const sql = `SELECT * FROM users WHERE email = ?`;
  db.get(sql, [gmail], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(400).json({ msg: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
