namespace backend.Infrastructure;

/// <summary>
/// Helper para disparar tareas fire-and-forget (especialmente emails) sin esperar
/// al resultado, pero loggeando cualquier excepción que ocurra. Sustituye al patrón
/// <c>_ = miTask()</c> que descarta silenciosamente los errores.
/// </summary>
public static class FireAndForget
{
    public static void Run(Task task, ILogger logger, string tag)
    {
        _ = task.ContinueWith(t =>
        {
            if (t.IsFaulted && t.Exception != null)
            {
                logger.LogError(t.Exception, "[FireAndForget] Tarea {Tag} falló", tag);
            }
        }, TaskScheduler.Default);
    }
}
