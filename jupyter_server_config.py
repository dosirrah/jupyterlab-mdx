from jupyter_server.auth import IdentityProvider


class NoAuthIdentityProvider(IdentityProvider):
    """Bypass all authentication for local/test use."""

    @property
    def auth_enabled(self):
        return False


c.ServerApp.identity_provider_class = NoAuthIdentityProvider
