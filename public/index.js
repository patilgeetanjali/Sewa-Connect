// Mobile nav toggle
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  // Ring-the-bell interaction
  const bellBtn = document.getElementById('bellBtn');
  const bellToast = document.getElementById('bellToast');
  bellBtn.addEventListener('click', () => {
    bellBtn.classList.remove('ringing');
    void bellBtn.offsetWidth; // restart animation
    bellBtn.classList.add('ringing');
    bellToast.classList.add('show');
    clearTimeout(bellBtn._t);
    bellBtn._t = setTimeout(() => bellToast.classList.remove('show'), 1800);
  });

 // Search form (front-end only demo)
  const searchForm = document.getElementById('searchForm');
  const searchNote = document.getElementById('searchNote');

  if (searchForm && searchNote) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const category = document.getElementById('category')?.value;
      const location = document.getElementById('location')?.value.trim();

      if (!category || !location) {
        searchNote.textContent =
          "Pick a service and add your area to see who's nearby.";
        return;
      }

      searchNote.textContent =
        `Looking for ${category.toLowerCase()}s near "${location}" — this is a demo, so no live results yet.`;
    });
  }

  
  // Service provider popup
  const categoryTiles = document.querySelectorAll("[data-category]");
  const providerModal = document.getElementById("providerModal");
  const closeProviderModal = document.getElementById("closeProviderModal");
  const providerModalTitle = document.getElementById("providerModalTitle");
  const providerModalMessage = document.getElementById("providerModalMessage");
  const providerModalGrid = document.getElementById("providerModalGrid");

  let previousFocus = null;

  function closeProvidersModal() {
    providerModal.classList.remove("open");
    providerModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (previousFocus) previousFocus.focus();
  }

  closeProviderModal.addEventListener("click", closeProvidersModal);

  providerModal.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", closeProvidersModal);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && providerModal.classList.contains("open")) {
      closeProvidersModal();
    }
  });

  categoryTiles.forEach(tile => {
    tile.addEventListener("click", async event => {
      event.preventDefault();

      const category = tile.dataset.category;
      previousFocus = tile;

      providerModal.classList.add("open");
      providerModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      providerModalTitle.textContent = `Available ${category} providers`;
      providerModalMessage.textContent = "Loading providers...";
      providerModalGrid.replaceChildren();
      closeProviderModal.focus();

      try {
        const response = await fetch(
          `/api/providers?category=${encodeURIComponent(category)}`
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load providers.");
        }

        const providers = result.providers || [];

        if (providers.length === 0) {
          providerModalMessage.textContent =
            `No available ${category.toLowerCase()} providers found yet.`;
          return;
        }

        providerModalMessage.textContent =
          `${providers.length} available service listing(s).`;

        providers.forEach(provider => {
          const card = document.createElement("article");
          card.className = "provider-modal-card";

          const name = document.createElement("h3");
          name.textContent = provider.name;

          const service = document.createElement("p");
          service.textContent = provider.category_name;

          const price = document.createElement("p");
          price.className = "provider-price";
          price.textContent =
            `₹${Number(provider.price_per_day).toLocaleString("en-IN")} per day`;

          const description = document.createElement("p");
          description.textContent =
            provider.description || "No description provided.";

          const bookButton = document.createElement("button");
          bookButton.className = "book-btn";
          bookButton.textContent = "Login to book";
          bookButton.addEventListener("click", () => {
            window.location.href = "login.html";
          });

          card.append(name, service, price, description, bookButton);
          providerModalGrid.appendChild(card);
        });
      } catch (error) {
        providerModalMessage.textContent =
          error.message || "Unable to load providers. Please try again.";
      }
    });
  });
