const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

const corsOptions = {
  origin: "https://cdnjs.cloudflare.com",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.static("pages"));
app.use(express.static("artifacts/contracts"));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
