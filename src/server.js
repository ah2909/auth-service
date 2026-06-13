import app from "./app.js";
import { sequelize } from "./config/database.js";
import { config } from "./config/index.js";

/*
payload JWT
{
  "id": user_id,
  "email": ,
  "name": ,
  "avatar_url": ,
  "iat": ,
  "exp":
}
*/

await sequelize.sync();

app.listen(config.port, function () {
    console.log(`Listening on port ${config.port}`);
});
