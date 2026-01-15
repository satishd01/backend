module.exports = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.role !== "business_owner") {
    return res.status(403).json({ message: "Only vendors allowed" });
  }

  if (!user.isOtpVerified) {
    return res.status(403).json({ message: "OTP verification required" });
  }

  next();
};
