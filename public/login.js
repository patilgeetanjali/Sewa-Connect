
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";

    passwordInput.type = showPassword ? "text" : "password";
    togglePassword.textContent = showPassword ? "Hide" : "Show";
    togglePassword.setAttribute("aria-pressed", String(showPassword));
    togglePassword.setAttribute(
      "aria-label",
      showPassword ? "Hide password" : "Show password"
    );
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    formMessage.textContent = "";
    formMessage.className = "form-message";

    const credentials = {
      email: document.getElementById("email").value.trim(),
      password: passwordInput.value
    };

    if (!credentials.email || !credentials.password) {
      formMessage.textContent = "Please enter your email and password.";
      formMessage.classList.add("error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(credentials)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Invalid email or password.");
      }

      const destinations = {
        customer: "customer-dashboard.html",
        provider: "provider-dashboard.html",
        admin: "admin-dashboard.html"
      };

      const destination = destinations[result.user?.role];

      if (!destination) {
        formMessage.textContent =
          "Login response is missing a valid user role. Check your backend.";
        formMessage.classList.add("error");
        return;
      }

      formMessage.textContent = "Login successful. Redirecting...";
      formMessage.classList.add("success");

      window.location.replace(destination);

    } catch (error) {
      formMessage.textContent =
        error.message === "Failed to fetch"
          ? "Cannot connect to the server. Start your backend and try again."
          : error.message || "Login failed. Please try again.";

      formMessage.classList.add("error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  });
}
