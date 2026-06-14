try:
    from celery import Celery
    has_celery = True
except ImportError:
    has_celery = False

from app.core.config import settings

if has_celery:
    celery_app = Celery(
        "tasks",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
        include=["app.tasks.ingestion"]
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
    )
else:
    # High-fidelity Mock Celery Client for testing environment resilience
    class MockCeleryApp:
        class Conf:
            def update(self, *args, **kwargs):
                pass
        def __init__(self):
            self.conf = self.Conf()
        def task(self, *args, **kwargs):
            def decorator(func):
                class MockTask:
                    def __init__(self, f):
                        self.f = f
                    def delay(self, *task_args, **task_kwargs):
                        # Run synchronously in test environments
                        return self.f(*task_args, **task_kwargs)
                    def __call__(self, *task_args, **task_kwargs):
                        return self.f(*task_args, **task_kwargs)
                return MockTask(func)
            return decorator

    celery_app = MockCeleryApp()

