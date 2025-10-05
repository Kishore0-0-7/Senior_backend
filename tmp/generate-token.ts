import jwt from "jsonwebtoken";

const secret = "your_super_secret_jwt_key_change_this_in_production_12345";
const token = jwt.sign(
  {
    id: "9f0e805e-6dae-4065-9eba-eeefb6f6d84c",
    email: "mrmks46007@gmail.com",
    role: "student",
  },
  secret,
  { expiresIn: "7d" }
);

console.log(token);
