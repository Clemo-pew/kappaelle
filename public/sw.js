/* Service worker Kappaelle: notifiche push e badge sull'icona dell'app. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Necessario perché alcuni browser considerino l'app installabile.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Kappaelle";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/notifiche" },
  };

  const jobs = [self.registration.showNotification(title, options)];
  if (typeof data.unread === "number" && "setAppBadge" in self.navigator) {
    jobs.push(
      data.unread > 0 ? self.navigator.setAppBadge(data.unread) : self.navigator.clearAppBadge(),
    );
  }
  event.waitUntil(Promise.all(jobs).catch(() => {}));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then(() => ("navigate" in w ? w.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
