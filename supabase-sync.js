(() => {
  const DATA_KEYS = [
    "products", "clientes", "historialPedidos",
    "ventasRealizadas", "cuentasPorCobrar", "ultimaFechaVisita"
  ];
  const LOCAL_ONLY_KEYS = new Set([
    "cart", "clienteSeleccionado", "clienteMapaSeleccionado",
    "currentUser", "usuarioSesion", "nombreUsuario", "rol"
  ]);
  const TABLE = "app_data";
  let client, channel, writing = false, timer = null;
  const originalSet = localStorage.setItem.bind(localStorage);
  const originalRemove = localStorage.removeItem.bind(localStorage);
  const validConfig = () =>
    window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes("TU-PROYECTO") &&
    !window.SUPABASE_ANON_KEY.includes("TU_SUPABASE");

  function showError(message) {
    console.error("[Supabase]", message);
    const el = document.getElementById("sync-status");
    if (el) el.textContent = "Error de sincronización: " + message;
  }
  function setStatus(message) {
    const el = document.getElementById("sync-status");
    if (el) el.textContent = message;
  }
  async function requireSession() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace("login.html?next=" + next);
      return false;
    }
    return true;
  }
  async function loadInitialData() {
    const { data, error } = await client.from(TABLE).select("id,data");
    if (error) throw error;
    writing = true;
    for (const row of (data || [])) {
      if (DATA_KEYS.includes(row.id)) {
        originalSet(row.id, JSON.stringify(row.data ?? []));
      }
    }
    writing = false;
  }
  async function saveKey(key, value) {
    if (!DATA_KEYS.includes(key) || writing) return;
    let data;
    try { data = JSON.parse(value); } catch { data = value; }
    const { error } = await client.from(TABLE).upsert(
      { id: key, data, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (error) showError(error.message);
    else setStatus("Sincronizado");
  }
  function scheduleSave(key, value) {
    if (!DATA_KEYS.includes(key) || writing) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveKey(key, value), 350);
    setStatus("Guardando cambios…");
  }
  function subscribe() {
    channel = client.channel("app-data-realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        payload => {
          const row = payload.new;
          if (!row || !DATA_KEYS.includes(row.id)) return;
          writing = true;
          originalSet(row.id, JSON.stringify(row.data ?? []));
          writing = false;
          window.dispatchEvent(new StorageEvent("storage", {
            key: row.id, newValue: JSON.stringify(row.data ?? []),
            storageArea: localStorage
          }));
          setStatus("Datos actualizados automáticamente");
        })
      .subscribe(status => {
        if (status === "SUBSCRIBED") setStatus("En vivo · Supabase conectado");
      });
  }
  async function start() {
    if (!validConfig()) {
      showError("Configura SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js.");
      return;
    }
    if (!window.supabase?.createClient) {
      showError("No se pudo cargar la biblioteca de Supabase.");
      return;
    }
    client = window.supabase.createClient(
      window.SUPABASE_URL, window.SUPABASE_ANON_KEY
    );
    if (!(await requireSession())) return;
    try {
      await loadInitialData();
      subscribe();
      setStatus("En vivo · Supabase conectado");
    } catch (e) { showError(e.message || String(e)); }
  }
  localStorage.setItem = function(key, value) {
    originalSet(key, value);
    if (!LOCAL_ONLY_KEYS.has(key)) scheduleSave(key, value);
  };
  localStorage.removeItem = function(key) {
    originalRemove(key);
    if (DATA_KEYS.includes(key)) scheduleSave(key, "[]");
  };
  window.addEventListener("beforeunload", () => {
    if (channel && client) client.removeChannel(channel);
  });
  start();
})();
