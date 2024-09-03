const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const path = require("path");

const app = express();
const port = 3000;

// Setup MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "perpustakaan",
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to MySQL");
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Session setup
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
  })
);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, "public/uploads"), // Gunakan path absolut
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // limit 1MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).single("coverImage");

// Check file type
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

// Routes

// Home route
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/views/login.html");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        req.session.loggedin = true;
        req.session.username = username;
        req.session.role = results[0].role;
        res.redirect("/home");
      } else {
        res.send("Incorrect Username and/or Password!");
      }
    }
  );
});

// Home page after login
app.get("/home", (req, res) => {
  if (req.session.loggedin) {
    db.query("SELECT * FROM books", (err, results) => {
      if (err) throw err;
      res.render("home", {
        username: req.session.username,
        role: req.session.role,
        books: results,
      });
    });
  } else {
    res.send("Please login to view this page!");
  }
});

// Admin - Add book (with image)
app.get("/admin/addbook", (req, res) => {
  if (req.session.loggedin && req.session.role === "admin") {
    res.sendFile(__dirname + "/views/addbook.html");
  } else {
    res.send("Access denied!");
  }
});

app.post("/admin/addbook", (req, res) => {
  if (req.session.loggedin && req.session.role === "admin") {
    upload(req, res, (err) => {
      if (err) {
        res.send("Error uploading image!");
      } else {
        const { title, author, genre, year } = req.body;
        // Tentukan nama file default jika tidak ada file yang diunggah
        const coverImage = req.file ? req.file.filename : "default_cover.png";

        db.query(
          "INSERT INTO books (title, author, genre, year, cover_image) VALUES (?, ?, ?, ?, ?)",
          [title, author, genre, year, coverImage],
          (err) => {
            if (err) throw err;
            res.redirect("/home");
          }
        );
      }
    });
  } else {
    res.send("Access denied!");
  }
});

// Admin - Edit book
app.get("/admin/editbook/:id", (req, res) => {
  if (req.session.loggedin && req.session.role === "admin") {
    const bookId = req.params.id;
    db.query("SELECT * FROM books WHERE id = ?", [bookId], (err, result) => {
      if (err) throw err;
      res.render("editbook", { book: result[0] });
    });
  } else {
    res.send("Access denied!");
  }
});

app.post("/admin/editbook/:id", (req, res) => {
  if (req.session.loggedin && req.session.role === "admin") {
    const bookId = req.params.id;
    const { title, author, genre, year } = req.body;
    db.query(
      "UPDATE books SET title = ?, author = ?, genre = ?, year = ? WHERE id = ?",
      [title, author, genre, year, bookId],
      (err) => {
        if (err) throw err;
        res.redirect("/home");
      }
    );
  } else {
    res.send("Access denied!");
  }
});

// Admin - Delete book
// Admin - Delete book
app.post("/admin/deletebook/:id", (req, res) => {
  if (req.session.loggedin && req.session.role === "admin") {
    const bookId = req.params.id;
    db.query("DELETE FROM books WHERE id = ?", [bookId], (err) => {
      if (err) throw err;
      res.redirect("/home");
    });
  } else {
    res.send("Access denied!");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
