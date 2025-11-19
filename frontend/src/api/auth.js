// frontend/src/api/auth.js
import api from "../utils/api";

// === REGISTER ===
export async function registerUser({ name, email, password, role }) {
  try {
    const res = await api.post("/auth/register", { name, email, password, role });
    return { success: true, data: res.data };
  } catch (err) {
    console.error("Register error:", err);
    return { success: false, message: err.response?.data?.message || "Registration failed" };
  }
}

// === LOGIN ===
export async function loginUser({ email, password }) {
  try {
    const res = await api.post("/auth/login", { email, password });
    const { token, user } = res.data;

    if (token) localStorage.setItem("token", token);
    if (user?.role) localStorage.setItem("role", user.role);

    return { success: true, data: user };
  } catch (err) {
    console.error("Login error:", err);
    return { success: false, message: err.response?.data?.message || "Login failed" };
  }
}

// === GET CURRENT USER ===
export async function getCurrentUser() {
  try {
    const res = await api.get("/auth/me");
    const user = res.data;

    if (user?.role) localStorage.setItem("role", user.role);

    return { success: true, data: user };
  } catch (err) {
    console.error("GetCurrentUser error:", err);
    return { success: false, message: err.response?.data?.message || "Failed to fetch user" };
  }
}
