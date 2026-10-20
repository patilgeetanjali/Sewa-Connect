
const API = "/api/customer";

const profileForm = document.getElementById("profileForm");
const editAddressBtn = document.getElementById("editAddressBtn");
const cancelAddressBtn = document.getElementById("cancelAddressBtn");
const addressActions = document.getElementById("addressActions");
const profileAddress = document.getElementById("profileAddress");
const pageMessage = document.getElementById("pageMessage");

const categoryFilter = document.getElementById("categoryFilter");
const servicesList = document.getElementById("servicesList");

const bookingForm = document.getElementById("bookingForm");
const serviceIdInput = document.getElementById("serviceId");
const selectedServiceText = document.getElementById("selectedServiceText");
const bookingAddress = document.getElementById("bookingAddress");
const bookingDate = document.getElementById("bookingDate");
const bookBtn = document.getElementById("bookBtn");

const bookingsList = document.getElementById("bookingsList");

let originalAddress = "";
let selectedService = null;

// Set the earliest booking date to today.
const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

bookingDate.min = localToday;
bookingDate.value = localToday;

// Show messages to the customer.
function showMessage(message, type = "error") {
    pageMessage.textContent = message;
    pageMessage.className = type === "success"
        ? "message success"
        : "message";
}

// Make authenticated API requests.
// The server's HTTP-only login cookie is sent automatically.
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        if (response.status === 401) {
            window.location.href = "/login.html";
        }

        throw new Error(
            data.message || "You are not authorized to perform this action."
        );
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

// Load customer profile.
async function loadProfile() {
    try {
        const profile = await apiRequest(`${API}/profile`);

        document.getElementById("profileName").value = profile.name || "";
        document.getElementById("profileEmail").value = profile.email || "";
        document.getElementById("profilePhone").value = profile.phone || "";
        profileAddress.value = profile.address || "";

        originalAddress = profile.address || "";

        document.getElementById("welcomeName").textContent =
            `Welcome, ${profile.name || "Customer"}!`;

        // Use the registered address as the initial booking address.
        bookingAddress.value = profile.address || "";
    } catch (error) {
        showMessage(error.message);
    }
}

// Enable editing only for the address.
editAddressBtn.addEventListener("click", () => {
    originalAddress = profileAddress.value;
    profileAddress.readOnly = false;
    addressActions.classList.remove("hidden");
    editAddressBtn.classList.add("hidden");
    profileAddress.focus();
});

// Cancel address editing.
cancelAddressBtn.addEventListener("click", () => {
    profileAddress.value = originalAddress;
    profileAddress.readOnly = true;
    addressActions.classList.add("hidden");
    editAddressBtn.classList.remove("hidden");
});

// Save the updated address.
profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const address = profileAddress.value.trim();

    if (!address) {
        showMessage("Please enter your address.");
        return;
    }

    try {
        const result = await apiRequest(`${API}/profile/address`, {
            method: "PUT",
            body: JSON.stringify({ address })
        });

        originalAddress = address;
        profileAddress.value = address;
        profileAddress.readOnly = true;
        addressActions.classList.add("hidden");
        editAddressBtn.classList.remove("hidden");

        showMessage(result.message || "Address updated successfully.", "success");
    } catch (error) {
        showMessage(error.message);
    }
});

// Load service categories.
async function loadCategories() {
    try {
        const categories = await apiRequest(`${API}/categories`);

        categoryFilter.replaceChildren(
            new Option("All Categories", "")
        );

        categories.forEach((category) => {
            categoryFilter.add(
                new Option(category.category_name, category.category_name)
            );
        });
    } catch (error) {
        showMessage(error.message);
    }
}

// Safely create an element containing text.
function createTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text ?? "";
    return element;
}

// Load available services, optionally filtered by category.
async function loadServices() {
    servicesList.replaceChildren(
        createTextElement("p", "", "Loading services...")
    );

    try {
        const category = categoryFilter.value;
        const query = category
            ? `?category=${encodeURIComponent(category)}`
            : "";

        const services = await apiRequest(`${API}/services${query}`);

        servicesList.replaceChildren();

        if (!services.length) {
            servicesList.append(
                createTextElement(
                    "p",
                    "",
                    "No services are currently available in this category."
                )
            );
            return;
        }

        services.forEach((service) => {
            const card = document.createElement("article");
            card.className = "service-card";

            card.append(
                createTextElement(
                    "span",
                    "service-category",
                    service.category_name
                ),
                createTextElement("h3", "", service.category_name),
                createTextElement(
                    "p",
                    "",
                    service.description || "Professional local service."
                ),
                createTextElement(
                    "p",
                    "",
                    `Provider: ${service.provider_name}`
                ),
                createTextElement(
                    "p",
                    "",
                    `Contact: ${service.provider_phone || "Not provided"}`
                ),
                createTextElement(
                    "p",
                    "service-price",
                    `₹${Number(service.price_per_day).toFixed(2)} / day`
                )
            );

            const button = createTextElement("button", "btn", "Book Service");
            button.type = "button";

            button.addEventListener("click", () => {
                selectedService = service;
                serviceIdInput.value = service.service_id;

                selectedServiceText.textContent =
                    `${service.category_name} — ${service.provider_name} — ` +
                    `₹${Number(service.price_per_day).toFixed(2)} per day`;

                bookBtn.disabled = false;

                document.getElementById("bookingSection").scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });

            card.append(button);
            servicesList.append(card);
        });
    } catch (error) {
        servicesList.replaceChildren(
            createTextElement("p", "", error.message)
        );
    }
}

categoryFilter.addEventListener("change", loadServices);

// Submit a booking request.
bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedService || !serviceIdInput.value) {
        showMessage("Please select a service first.");
        return;
    }

    if (!bookingAddress.value.trim()) {
        showMessage("Please enter the service address.");
        return;
    }

    const currentDate = new Date();
const todayString = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0")
].join("-");

if (!bookingDate.value || bookingDate.value < todayString) {
    showMessage("Please choose today or a future booking date.");
    return;
}

    bookBtn.disabled = true;

    try {
        const result = await apiRequest(`${API}/bookings`, {
            method: "POST",
            body: JSON.stringify({
                serviceId: Number(serviceIdInput.value),
                bookingDate: bookingDate.value,
                serviceAddress: bookingAddress.value.trim(),
                description: document.getElementById("bookingDescription").value.trim()
            })
        });

        showMessage(
            `${result.message || "Booking submitted successfully."}` +
            (result.bookingId ? ` Booking ID: ${result.bookingId}` : ""),
            "success"
        );

        bookingForm.reset();
        bookingDate.value = localToday;
        selectedService = null;
        serviceIdInput.value = "";
        selectedServiceText.textContent =
            "Choose a service from the list above.";
        bookBtn.disabled = true;

        await loadBookings();
    } catch (error) {
        showMessage(error.message);
    } finally {
        bookBtn.disabled = !selectedService;
    }
});

// Load booking history.
async function loadBookings() {
    bookingsList.replaceChildren(
        createTextElement("p", "", "Loading bookings...")
    );

    try {
        const bookings = await apiRequest(`${API}/bookings`);
        bookingsList.replaceChildren();

        if (!bookings.length) {
            bookingsList.append(
                createTextElement("p", "", "You haven't booked any services yet.")
            );
            return;
        }

        bookings.forEach((booking) => {
            const item = document.createElement("article");
            item.className = "booking-item";

            item.append(
                createTextElement(
                    "h3",
                    "",
                    `${booking.category_name} — Booking #${booking.booking_id}`
                ),
                createTextElement(
                    "p",
                    "",
                    `Provider: ${booking.provider_name}`
                ),
                createTextElement(
                    "p",
                    "",
                    `Date: ${new Date(
                        `${booking.booking_date}T00:00:00`
                    ).toLocaleDateString("en-IN")}`
                ),
                createTextElement(
                    "p",
                    "",
                    `Address: ${booking.service_address}`
                ),
                createTextElement(
                    "p",
                    "",
                    `Price: ₹${Number(booking.price).toFixed(2)}`
                ),
                createTextElement(
                    "span",
                    "status",
                    (booking.status || "pending").replaceAll("_", " ")
                )
            );

            if (booking.description) {
                item.append(
                    createTextElement("p", "", `Details: ${booking.description}`)
                );
            }

            bookingsList.append(item);
        });
    } catch (error) {
        bookingsList.replaceChildren(
            createTextElement("p", "", error.message)
        );
    }
}

document.getElementById("refreshBookingsBtn").addEventListener(
    "click",
    loadBookings
);

// Log out and clear the authentication cookie on the server.
document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin"
        });

        if (!response.ok) {
            showMessage("Unable to log out. Please try again.");
            return;
        }

        window.location.href = "/login.html";
    } catch {
        showMessage("Unable to connect to the server. Please try again.");
    }
});

// Initialize the dashboard.
async function initializeDashboard() {
    await loadProfile();
    await Promise.all([
        loadCategories(),
        loadServices(),
        loadBookings()
    ]);
}

initializeDashboard();
