
const API = "/api/provider";

const $ = (id) => document.getElementById(id);

function showMessage(message, isError = false) {
    $("pageMessage").textContent = message;
    $("pageMessage").style.color = isError ? "#C1440E" : "#1B6E63";
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

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = "/";
        }
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function addAction(container, label, action, className = "btn") {
    const button = makeElement("button", label, className);
    button.type = "button";
    button.addEventListener("click", action);
    container.appendChild(button);
}

async function loadProfile() {
    const data = await apiRequest("/profile");
    const provider = data.provider;

    $("providerName").textContent = provider.name;
    $("accountStatus").textContent = provider.status;

    const approved = provider.status === "active";

    $("serviceForm").querySelectorAll("input, select, textarea, button")
        .forEach((element) => {
            element.disabled = !approved;
        });

    if (!approved) {
        showMessage(
            "Your account is not approved yet. You can view your profile, but service management requires approval.",
            true
        );
    }
}

async function loadCategories() {
    const data = await apiRequest("/categories");
    const select = $("category");

    select.replaceChildren(
        new Option("Select a category", "")
    );

    data.categories.forEach((category) => {
        select.add(new Option(
            category.category_name,
            category.category_id
        ));
    });
}

async function loadServices() {
    const container = $("servicesList");
    container.textContent = "Loading services...";

    try {
        const data = await apiRequest("/services");
        container.replaceChildren();

        if (data.services.length === 0) {
            container.textContent = "You haven't added any services yet.";
            return;
        }

        data.services.forEach((service) => {
            const card = makeElement("article", "", "item");
            card.appendChild(makeElement("h3", service.category_name));
            card.appendChild(makeElement(
                "p",
                `Price per day: ₹${Number(service.price_per_day).toFixed(2)}`
            ));
            card.appendChild(makeElement(
                "p",
                service.description || "No description provided."
            ));
            card.appendChild(makeElement(
                "span",
                service.is_available ? "Available" : "Unavailable",
                "status"
            ));

            const actions = makeElement("div", "", "item-actions");

            addAction(
                actions,
                service.is_available ? "Disable service" : "Enable service",
                async () => {
                    try {
                        await apiRequest(
                            `/services/${service.service_id}/availability`,
                            {
                                method: "PATCH",
                                body: JSON.stringify({
                                    is_available: !service.is_available
                                })
                            }
                        );
                        showMessage("Service availability updated.");
                        await loadServices();
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

async function loadBookings() {
    const container = $("bookingsList");
    container.textContent = "Loading bookings...";

    try {
        const data = await apiRequest("/bookings");
        container.replaceChildren();

        if (data.bookings.length === 0) {
            container.textContent = "You don't have any customer bookings yet.";
            return;
        }

        data.bookings.forEach((booking) => {
            const card = makeElement("article", "", "item");

            card.appendChild(makeElement(
                "h3",
                `Booking #${booking.booking_id} — ${booking.category_name}`
            ));
            card.appendChild(makeElement(
                "p",
                `Customer: ${booking.customer_name}`
            ));

            const date = booking.booking_date instanceof Date
                ? booking.booking_date.toLocaleDateString()
                : String(booking.booking_date).slice(0, 10);

            card.appendChild(makeElement("p", `Date: ${date}`));
            card.appendChild(makeElement(
                "p",
                `Address: ${booking.service_address}`
            ));
            card.appendChild(makeElement(
                "p",
                `Price: ₹${Number(booking.price).toFixed(2)}`
            ));
            card.appendChild(makeElement(
                "p",
                `Description: ${booking.description || "None provided"}`
            ));
            card.appendChild(makeElement(
                "span",
                booking.status.replace("_", " "),
                "status"
            ));

            const actions = makeElement("div", "", "item-actions");

            const transitions = {
                pending: [
                    ["Accept", "accepted"],
                    ["Reject", "rejected"]
                ],
                accepted: [
                    ["Start service", "in_progress"]
                ],
                in_progress: [
                    ["Mark completed", "completed"]
                ]
            };

            (transitions[booking.status] || []).forEach(([label, status]) => {
                addAction(actions, label, async () => {
                    try {
                        await apiRequest(
                            `/bookings/${booking.booking_id}/status`,
                            {
                                method: "PATCH",
                                body: JSON.stringify({ status })
                            }
                        );

                        showMessage(`Booking #${booking.booking_id} updated.`);
                        await loadBookings();
                    } catch (error) {
                        showMessage(error.message, true);
                    }
                }, status === "rejected" ? "btn danger" : "btn");
            });

            if (actions.childElementCount > 0) {
                card.appendChild(actions);
            }

            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

$("serviceForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await apiRequest("/services", {
            method: "POST",
            body: JSON.stringify({
                category_id: $("category").value,
                price_per_day: $("price").value,
                description: $("description").value
            })
        });

        $("serviceForm").reset();
        showMessage("Service added successfully.");
        await loadServices();
    } catch (error) {
        showMessage(error.message, true);
    }
});

$("refreshServicesBtn").addEventListener("click", loadServices);
$("refreshBookingsBtn").addEventListener("click", loadBookings);

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
        await loadProfile();
        await loadCategories();

        if ($("accountStatus").textContent === "active") {
            await Promise.all([loadServices(), loadBookings()]);
        } else {
            $("servicesList").textContent =
                "Service management will be available after approval.";
            $("bookingsList").textContent =
                "Bookings will be available after approval.";
        }
    } catch (error) {
        showMessage(error.message, true);
    }
}

init();
