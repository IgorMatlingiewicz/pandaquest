import type pl from "../pl/auth";

const auth: typeof pl = {
  email: "Email",
  password: "Password",
  username: "Username",
  login: {
    title: "Log in",
    submit: "Log in",
    noAccount: "Don't have an account? Sign up",
    invalidCredentials: "Invalid email or password",
  },
  register: {
    title: "Sign up",
    submit: "Sign up",
    haveAccount: "Already have an account? Log in",
    failed: "Registration failed",
    emailTaken: "This email is already taken",
    invalidData:
      "Check your details: a valid email, a name of at least 3 characters, a password of at least 8",
  },
};

export default auth;
