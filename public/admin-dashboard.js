
const API = "/api/admin";

const $ = (id) => document.getElementById(id);

function showMessage(message, isError = false) {
    $("message").textContent = message;
    $("message").style.color = isError ? "#C1440E" : "#1B6E63";
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        window.location.href = "/";
        throw new Error("Admin access is required.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text ?? "";
    if (className) node.className = className;
    return node;
}

function actionButton(parent, label, callback, className = "btn") {
    const button = el("button", label, className);
    button.type = "button";
    button.addEventListener("click", callback);
    parent.appendChild(button);
}

function statusBadge(status) {
    return el("span", status, "status");
}

// Tabs
document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((item) => {
            item.classList.toggle("active", item === tab);
        });

        ["approvals", "users", "categories"].forEach((panel) => {
            $(`${panel}Panel`).classList.toggle(
                "hidden",
                panel !== tab.dataset.panel
            );
        });

        showMessage("");
    });
});

// Summary
async function loadSummary() {
    const data = await apiRequest("/summary");

    $("totalUsers").textContent = data.users.total_users ?? 0;
    $("totalCustomers").textContent = data.users.customers ?? 0;
    $("totalProviders").textContent = data.users.providers ?? 0;
    $("pendingProviders").textContent = data.users.pending_providers ?? 0;
}

// Provider approvals
async function loadProviders() {
    const container = $("providersList");
    container.textContent = "Loading providers...";

    try {
        const data = await apiRequest("/providers/pending");
        container.replaceChildren();

        if (!data.providers.length) {
            container.textContent = "No pending provider registrations.";
            return;
        }

        data.providers.forEach((provider) => {
            const card = el("article", "", "item");
            card.appendChild(el("h3", provider.name));
            card.appendChild(el("p", `Email: ${provider.email}`));
            card.appendChild(el("p", `Phone: ${provider.phone || "Not provided"}`));
            card.appendChild(el("p", `Address: ${provider.address || "Not provided"}`));
            card.appendChild(el(
                "p",
                `Category: ${provider.service_category || "Not specified"}`
            ));
            card.appendChild(el(
                "p",
                `Experience: ${provider.experience_years ?? "Not specified"}`
            ));

            const actions = el("div", "", "item-actions");

            actionButton(actions, "Approve", async () => {
                if (!confirm(`Approve ${provider.name} as a provider?`)) return;

                try {
                    await apiRequest(`/providers/${provider.user_id}/decision`, {
                        method: "PATCH",
                        body: JSON.stringify({ decision: "approve" })
                    });

                    showMessage("Provider approved successfully.");
                    await Promise.all([loadProviders(), loadUsers(), loadSummary()]);
                } catch (error) {
                    showMessage(error.message, true);
                }
            });

            actionButton(actions, "Reject", async () => {
                if (!confirm(`Reject ${provider.name}'s registration?`)) return;

                try {
                    await apiRequest(`/providers/${provider.user_id}/decision`, {
                        method: "PATCH",
                        body: JSON.stringify({ decision: "reject" })
                    });

                    showMessage("Provider registration rejected.");
                    await Promise.all([loadProviders(), loadUsers(), loadSummary()]);
                } catch (error) {
                    showMessage(error.message, true);
                }
            }, "btn danger");

            card.appendChild(statusBadge("pending"));
            card.appendChild(actions);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

// User management
async function loadUsers() {
    const container = $("usersList");
    container.textContent = "Loading users...";

    const params = new URLSearchParams();
    const search = $("userSearch").value.trim();
    const role = $("roleFilter").value;
    const status = $("statusFilter").value;

    if (search) params.set("search", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);

    try {
        const data = await apiRequest(`/users?${params.toString()}`);
        container.replaceChildren();

        if (!data.users.length) {
            container.textContent = "No matching users found.";
            return;
        }

        data.users.forEach((user) => {
            const card = el("article", "", "item");
            card.appendChild(el("h3", user.name));
            card.appendChild(el("p", `ID: ${user.user_id}`));
            card.appendChild(el("p", `Email: ${user.email}`));
            card.appendChild(el("p", `Phone: ${user.phone || "Not provided"}`));
            card.appendChild(el("p", `Role: ${user.role}`));
            card.appendChild(el("p", `Address: ${user.address || "Not provided"}`));
            card.appendChild(statusBadge(user.status));

            // Do not provide account-status controls for admin accounts
            // or for pending/rejected providers.
            if (
                user.role !== "admin" &&
                ["active", "inactive"].includes(user.status)
            ) {
                const actions = el("div", "", "item-actions");
                const nextStatus = user.status === "active" ? "inactive" : "active";
                const label = nextStatus === "active" ? "Activate account" : "Deactivate account";

                actionButton(actions, label, async () => {
                    const warning = nextStatus === "inactive"
                        ? "Deactivating this account may prevent the user from using the app. Continue?"
                        : "Activate this account?";

                    if (!confirm(warning)) return;

                    try {
                        await apiRequest(`/users/${user.user_id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: nextStatus })
                        });

                        showMessage(`Account ${nextStatus === "active" ? "activated" : "deactivated"}.`);
                        await Promise.all([loadUsers(), loadSummary()]);
                    } catch (error) {
                        showMessage(error.message, true);
                    }
                }, nextStatus === "inactive" ? "btn danger" : "btn");

                card.appendChild(actions);
            }

            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

$("userSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loadUsers();
});

$("refreshUsers").addEventListener("click", loadUsers);

// Categories
async function loadCategories() {
    const container = $("categoriesList");
    container.textContent = "Loading categories...";

    try {
        const data = await apiRequest("/categories");
        container.replaceChildren();

        if (!data.categories.length) {
            container.textContent = "No categories have been created.";
            return;
        }

        data.categories.forEach((category) => {
            const card = el("article", "", "item");
            card.appendChild(el("h3", category.category_name));
            card.appendChild(el(
                "p",
                category.description || "No description provided."
            ));
            card.appendChild(statusBadge(
                category.is_active ? "active" : "inactive"
            ));

            const actions = el("div", "", "item-actions");

            actionButton(
                actions,
                category.is_active ? "Deactivate category" : "Activate category",
                async () => {
                    const nextState = !category.is_active;
                    const warning = nextState
                        ? "Activate this category?"
                        : "Hide this category from new service listings? Existing records will remain.";

                    if (!confirm(warning)) return;

                    try {
                        await apiRequest(`/categories/${category.category_id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ is_active: nextState })
                        });

                        showMessage("Category status updated.");
                        await Promise.all([loadCategories(), loadSummary()]);
                    } catch (error) {
                        showMessage(error.message, true);
                    }
                }
            );

            card.appendChild(actions);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

$("categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await apiRequest("/categories", {
            method: "POST",
            body: JSON.stringify({
                category_name: $("categoryName").value.trim(),
                description: $("categoryDescription").value.trim()
            })
        });

        $("categoryForm").reset();
        showMessage("Category added successfully.");
        await Promise.all([loadCategories(), loadSummary()]);
    } catch (error) {
        showMessage(error.message, true);
    }
});

$("refreshCategories").addEventListener("click", loadCategories);
$("refreshProviders").addEventListener("click", loadProviders);

$("logoutBtn").addEventListener("click", async () => {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error("Logout failed. Please try again.");
        }

        window.location.href = "/";
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function init() {
    try {
        await loadSummary();
        await Promise.all([
            loadProviders(),
            loadUsers(),
            loadCategories()
        ]);
    } catch (error) {
        showMessage(error.message, true);
    }
}

init();
