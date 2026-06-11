from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core'

    def ready(self):
        from django.db.backends.signals import connection_created
        connection_created.connect(self._optimize_sqlite)

    @staticmethod
    def _optimize_sqlite(sender, connection, **kwargs):
        """Optimize SQLite for desktop performance — WAL mode, larger cache, memory temp."""
        if connection.vendor == 'sqlite':
            cursor = connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA cache_size=-20000;")   # 20MB
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.execute("PRAGMA temp_store=MEMORY;")
            cursor.execute("PRAGMA mmap_size=268435456;")  # 256MB
