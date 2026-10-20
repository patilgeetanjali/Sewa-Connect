
const registerForm = document.getElementById("registerForm");
const roleSelect = document.getElementById("role");
const providerFields = document.getElementById("providerFields");
const serviceSelect = document.getElementById("service");
const experienceInput = document.getElementById("experience");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

function updateRoleFields() {
  const isProvider = roleSelect.value === "provider";

  providerFields.hidden = !isProvider;
  serviceSelect.required = isProvider;
  experienceInput.required = isProvider;
}

roleSelect.addEventListener("change", updateRoleFields);
updateRoleFields();

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  formMessage.textContent = "";
  formMessage.className = "form-message";

  const password = document.getElementById("password").value;
  const confirmPassword =
    document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    formMessage.textContent = "Passwords do not match.";
    formMessage.classList.add("error");
    return;
  }

  const role = roleSelect.value;

  const userData = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    password,
    confirmPassword,
    role
  };

  if (role === "provider") {
    userData.serviceCategory = serviceSelect.value;
    userData.experienceYears = experienceInput.value;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Registration failed.");
    }

    formMessage.textContent =
      result.message || "Registration successful! You can now log in.";
    formMessage.classList.add("success");

    registerForm.reset();
    updateRoleFields();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);

  } catch (error) {
    formMessage.textContent =
      error.message === "Failed to fetch"
        ? "Cannot connect to the server. Start your backend and try again."
        : error.message || "Something went wrong. Please try again.";

    formMessage.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
  }
});
