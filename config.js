// ─── Configuración del PAC (Plan Anual de Centro) ────────────────────────────
// Proyecto de Supabase «Acceso Microsoft 365» (el mismo del Control de baños y la Reserva de espacios).
// Si supabaseUrl se deja vacío, la web funciona en MODO PRUEBA: guarda los datos solo en el navegador.
window.APP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // supabaseUrl: "https://hblayjaknhfxieqbzrlq.supabase.co",
  // supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibGF5amFrbmhmeGllcWJ6cmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg0ODEsImV4cCI6MjEwNjgwNDQ4MX0.K2iWyQAt9upNBXUhdZuV-Nle9fkCMYgQ6jTBBO0MluE",

  dominio: "salesianas.org",   // solo pueden entrar cuentas de este dominio

  // Datos del centro para la portada, las cabeceras y los pies de página del documento
  centro: "Escuelas Salesianas María Auxiliadora",
  sede: "Nervión · Sevilla",
  direccion: "C/ Santa María Mazzarello, 1 · 41005 Sevilla · 954 63 23 47",
  web: "www.nervion.salesianas.org",
};
