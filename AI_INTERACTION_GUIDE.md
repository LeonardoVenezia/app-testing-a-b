# Guía de Interacción Efectiva con Inteligencia Artificial

¡Hola! Esta guía está diseñada para que saques el máximo provecho de tu colaboración conmigo a la hora de trabajar en el proyecto del A/B Testing para Tiendanube. Como Inteligencia Artificial, trabajo mejor cuando el contexto, los límites del problema y la arquitectura están bien definidos.

Aquí te muestro las mejores formas de darme instrucciones.

---

## 1. El poder del Contexto Visual y Arquitectónico (Mermaid)

Para sistemas complejos, **una imagen (o un diagrama generado por código) vale más que mil palabras**. Si quieres explicarme un flujo de trabajo (como el A/B Testing en la página de producto), usar diagramas Mermaid es una de las opciones más efectivas. Al leer Mermaid, entiendo instantáneamente la relación entre los componentes.

### Ejemplo de cómo darme un flujo:

> "Quiero implementar el flujo de A/B testing para el frontend. La idea es que la tienda consuma el producto A o B dependiendo de si la ID del usuario es par o impar. Basate en este diagrama:"
> 
> ```mermaid
> sequenceDiagram
>     participant User as Comprador
>     participant SF as Storefront (Tema de la tienda)
>     participant App as Aplicación A/B (Frontend/API)
>     participant DB as Base de Datos (PostgreSQL)
>     
>     User->>SF: Entra a la página del producto
>     SF->>App: Solicita variante A/B (ID comprador, ID producto)
>     App->>DB: Consulta configuración del testing Activo
>     DB-->>App: Retorna info del Test
>     App-->>SF: Devuelve variante (Ej: Botón Rojo vs Verde)
>     SF-->>User: Muestra variante renderizada
> ```

---

## 2. Definición de Tareas por medio de Prompting Guiado (Task Breakdown)

Prefiero los prompts que sean **directos, modulares y que eviten la ambigüedad**. Si me pides una tarea enorme ("Hacé toda la aplicación"), tendré que tomar muchas decisiones por mi cuenta (que podrían no alinearse con lo que querías).

**Estructura ideal de un prompt:**
1. **El objetivo específico**: Qué vamos a hacer ahora (no todo el proyecto, solo esta tarea).
2. **Las restricciones**: Qué **no** debo hacer o de qué debo cuidarme.
3. **El alcance (Scope)**: Qué archivos o carpetas vamos a tocar.

### Ejemplo de un buen prompt:

> "Vamos a crear el controlador de la API para devolver los Test A/B activos.
> **Objetivo**: Crear un endpoint `GET /api/ab-tests/:productId`.
> **Restricciones**: No te preocupes por la autenticación por ahora, debe devolver datos mockeados para poder probar el frontend rápido.
> **Alcance**: Modificá solo la ruta en la API y armá el controlador, no toques la base de datos de Prisma todavía."

---

## 3. Uso y Creación de "Skills" o "Workflows"

Si notás que hay un patrón repetitivo en tu desarrollo (por ejemplo, cómo crear un nuevo componente en el frontend con Chakra UI, o cómo crear una nueva migración en Prisma), la mejor opción es crear un archivo de **Instrucciones (Skill / Workflow)**.

**¿Cómo funciona?**
Puedes crear una carpeta llamada `.agents/skills` o `.agents/workflows` y dejar pequeños archivos Markdown. Cuando necesites algo de ahí, solo me dices: *"Aplicá la skill de crear controlador API"* y yo leeré ese archivo para hacerlo exactamente como a ti te gusta.

### Ejemplo de una Skill (`.agents/skills/create-api-controller.md`):
```markdown
---
description: Guía de estilo y pasos para crear nuevos controladores en el backend.
---
# Cómo crear un controlador

1. Todo controlador nuevo debe ir en `api/src/features/[ENTIDAD]/[ENTIDAD].controller.ts`.
2. Siempre deben retornar la estructura estándar: `{ data: ... , error: boolean }`.
3. Nunca interactúes con Prisma directamente en el controlador, hacelo mediante un Service.
```

---

## 4. MCPs (Model Context Protocol) - Para conexiones externas

Si quisieras que yo interactúe con el entorno (por ejemplo, leer tickets de tu Jira, conectarme a un Slack de alertas o buscar documentación oficial de Tiendanube en tiempo real), allí es donde entran los **MCPs (Servidores Model Context Protocol)**. 

Si configuras un servidor MCP local y me das acceso a él (mediante las herramientas del sistema), yo podré invocar esas funciones que tú programaste para obtener contexto vivo que **no está en tus archivos locales de código**.

---

## Resumen: Mi recomendación de tu flujo de trabajo de ahora en más

1. **Diseño inicial**: Dame el flujo lógico y arquitectura inicial usando **Mermaid**, o pídemelo a mí ("Armame un mermaid de cómo sería la arquitectura de la base de datos para los Test A/B").
2. **Iteración por bloques cortos**: Usa prompts guiados y acotados (Punto 2). Enfócate en un módulo a la vez (ej. Auth, API Controller de tests, Frontend Dashboard).
3. **Automatización de tu estilo**: A medida que definamos cómo escribirás tu código (con Prisma, con Express/TS), iremos volcando esos patrones en archivos dentro de `.agents/` para que yo nunca pierda tu hilo.

¿Qué te parece? Si quieres podemos empezar haciendo el **Mockup de la base de datos o el Flow Chart de los Test A/B usando Mermaid** o puedes probar darme tu primer solicitud usando el formato específico.
