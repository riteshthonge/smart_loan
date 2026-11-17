const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { text, password, fail } = require("../utils");
const publicUser = (u) => {
  const data = u.toObject();
  delete data.passwordHash;
  return data;
};
const session = (res, user) => {
  res.cookie(
    "session",
    jwt.sign({}, process.env.JWT_SECRET, {
      subject: String(user._id),
      expiresIn: "8h",
      algorithm: "HS256",
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 28800000,
    },
  );
  res.json({ user: publicUser(user) });
};
exports.register = async (req, res) => {
  const email = text(req.body.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, "Enter a valid email.");
  const user = await User.create({
    name: text(req.body.name, "Name", 100),
    email,
    passwordHash: await bcrypt.hash(password(req.body.password), 12),
    role: "APPLICANT",
  });
  session(res, user);
};
exports.login = async (req, res) => {
  const email = text(req.body.email, "Email", 254).toLowerCase();
  const pass = text(req.body.password, "Password", 128);
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(pass, user.passwordHash)))
    fail(401, "Email or password is incorrect.");
  session(res, user);
};
exports.me = async (req, res) => res.json({ user: publicUser(req.user) });
exports.logout = async (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ message: "Signed out." });
};
exports.changePassword = async (req, res) => {
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (
    !(await bcrypt.compare(
      text(req.body.currentPassword, "Current password", 128),
      user.passwordHash,
    ))
  )
    fail(400, "Current password is incorrect.");
  user.passwordHash = await bcrypt.hash(password(req.body.newPassword), 12);
  await user.save();
  res.json({ message: "Password updated." });
};
