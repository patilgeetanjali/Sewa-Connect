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
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('category').value;
    const location = document.getElementById('location').value.trim();
    if (!category || !location) {
      searchNote.textContent = 'Pick a service and add your area to see who\'s nearby.';
      return;
    }
    searchNote.textContent = `Looking for ${category.toLowerCase()}s near "${location}" — this is a demo, so no live results yet.`;
  });