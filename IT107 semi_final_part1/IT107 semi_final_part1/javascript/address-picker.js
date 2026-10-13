// Cascading Philippine address dropdowns: Region -> Province -> City/Municipality
// -> Barangay, from php/address.php (official PSGC list). Each list only shows
// places inside the one above it, and changing a level clears the levels below.
// Markup: selects with data-level="region|province|city|barangay" inside `container`.
// Usage: const picker = attachAddressPicker(container); await picker.restore(savedFields);

(function () {
  const ORDER = ['region', 'province', 'city', 'barangay'];
  const API_LEVEL = { region: 'regions', province: 'provinces', city: 'cities', barangay: 'barangays' };
  const PLACEHOLDER = { region: 'Select region', province: 'Select province', city: 'Select city / municipality', barangay: 'Select barangay' };

  function attachAddressPicker(container) {
    const selects = Object.fromEntries(ORDER.map(level => [level, container.querySelector(`select[data-level="${level}"]`)]));

    function reset(level, text) {
      const select = selects[level];
      select.innerHTML = `<option value="">${text || PLACEHOLDER[level]}</option>`;
      select.disabled = true;
    }

    async function load(level, parent = '') {
      const select = selects[level];
      reset(level, 'Loading…');
      const query = level === 'region' ? 'level=regions' : `level=${API_LEVEL[level]}&parent=${encodeURIComponent(parent)}`;
      const response = await fetch(`../php/address.php?${query}`);
      const data = await response.json();
      select.innerHTML = `<option value="">${PLACEHOLDER[level]}</option>` + (data.options || [])
        .map(option => `<option value="${option.code}">${option.name.replace(/</g, '&lt;')}</option>`).join('');
      select.disabled = false;
      // A level with a single choice (e.g. Metro Manila for NCR) is picked automatically.
      if ((data.options || []).length === 1) {
        select.value = data.options[0].code;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    ORDER.forEach((level, index) => {
      selects[level].addEventListener('change', () => {
        ORDER.slice(index + 1).forEach(lower => reset(lower));
        const child = ORDER[index + 1];
        if (child && selects[level].value) load(child, selects[level].value).catch(() => reset(child, 'Could not load list'));
      });
    });

    ORDER.slice(1).forEach(level => reset(level));
    const ready = load('region').catch(() => reset('region', 'Could not load regions'));

    return {
      selects,
      complete: () => ORDER.every(level => selects[level].value),
      // Re-select saved codes after a refresh, level by level.
      async restore(fields) {
        await ready;
        for (let i = 0; i < ORDER.length; i++) {
          const select = selects[ORDER[i]];
          const code = fields?.[select.name];
          if (!code || ![...select.options].some(option => option.value === code)) return;
          select.value = code;
          if (ORDER[i + 1]) await load(ORDER[i + 1], code);
        }
      },
    };
  }

  window.attachAddressPicker = attachAddressPicker;
})();
