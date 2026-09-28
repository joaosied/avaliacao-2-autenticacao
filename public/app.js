fetch("/api/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .catch(() => null)
  .then((user) => {
    const status = document.getElementById("status");
    status.textContent = user
      ? `Sessão de ${user.email ?? user.displayName} (${user.provider}).`
      : "Nenhuma sessão neste navegador.";
    document.getElementById("login").hidden = Boolean(user);
    document.getElementById("logout").hidden = !user;
  });
