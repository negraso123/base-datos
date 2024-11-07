const express = require("express");
const cors = require("cors");
const url = require("url");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocket.Server({ noServer: true });

app.use(
  session({
    secret: "ohhhmysecret",
    resave: true,
    saveUninitialized: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static(path.join(__dirname, "../public")));

const renderHTML = path.resolve(__dirname, "../public/index.html");
app.get("/", function (req, res) {
  res.sendFile(renderHTML);
});

// Conectar a SQLite
const db = new sqlite3.Database("./mydatabase.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Crear tabla de usuarios
db.run(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  apellido TEXT,
  mascota TEXT,
  email TEXT UNIQUE,
  password INTEGER
)`);

// Ruta de registro
app.post("/register", async (req, res) => {
  const { nombre, apellido, mascota, email, password } = req.body;
  console.log("Form: ", req.body);
  console.log("nombre: ", nombre);
  console.log("apellido: ", apellido);
  console.log("email: ", email);

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `INSERT INTO users (nombre, mascota, email, password) VALUES (?, ?, ?, ?)`;
  db.run(sql, [nombre, mascota, email, hashedPassword], function (err) {
    if (err) {
      console.log("Error1: ", err);
      return res.status(400).json({ error: err.message });
    }
    // res.json({ id: this.lastID, nombre, mascota, email });
    console.log("redirect: ");
    return res.redirect("/register-login");
  });

  console.log("final: ");
});

// Ruta de inicio de sesión
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("login: ", req.body);
  if (email && password) {
    console.log("asd1");
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        return res.status(404).json({ msg: "Credenciales no validas" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Credenciales no validas" });
      }

      const token = jwt.sign({ id: user.id }, "your_jwt_secret", {
        expiresIn: "1h",
      });
      // return res.status(200).json({ token });
      res
        .cookie("token", token, { httpOnly: true, secure: true })
        .status(200)
        .send({ token });
    });
  } else {
    return res
      .status(400)
      .json({ msg: "Debe proporcionar usuario y password" });
  }
});

function verifyToken(req, res, next) {
  const header = req.header("Authorization") || "";
  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }
  try {
    const payload = jwt.verify(token, secretKey);
    req.username = payload.username;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token not valid" });
  }
}

app.get("/protected", verifyToken, (req, res) => {
  return res.status(200).json({ message: "You have access" });
});

// New /test endpoint
app.get("/test", (req, res) => {
  // Broadcast message to all connected WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("Hello, WebSocket clients!");
    }
  });

  res.send("Message sent to all WebSocket clients");
});

// New /test endpoint
app.post("/message", (req, res) => {
  const { message } = req.body;

  // Broadcast message to all connected WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.clientType !== "App") {
      console.log("Sending message to ESP: ", client.clientType);
      client.send(message);
    }
  });

  res.send("Message sent OK to clients!");
});

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
  console.log("New WebSocket client connected");

  const parameters = url.parse(req.url, true);
  const clientType = parameters.query.clientType;
  console.log(`ClientType: ${clientType}`);
  ws.clientType = clientType;

  ws.on("message", (message) => {
    console.log(`Received message: ${message} from ${ws.clientType}`);

    // TODO: Mover a una funcion
    wss.clients.forEach((client) => {
      if (client.clientType === "App" && client.readyState === WebSocket.OPEN) {
        console.log("Sending message to App");
        client.send(message);
      }
    });

    // ws.send("Message received");
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

// Handle upgrade requests to upgrade HTTP to WebSocket
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
