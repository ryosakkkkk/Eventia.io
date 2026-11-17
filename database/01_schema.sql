/*
  EVENTIA - Esquema base para Microsoft SQL Server
  Compatible a nivel de nombres de tablas/columnas con el esquema MySQL compartido.
  Ejecutar en SQL Server Management Studio (SSMS).
  IMPORTANTE: el script crea una base nueva llamada EventiaDB. No elimina bases existentes.
*/

IF DB_ID(N'EventiaDB') IS NULL
    CREATE DATABASE EventiaDB;
GO
USE EventiaDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Usuarios y autenticación */
CREATE TABLE dbo.usuarios (
    id_usuario BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_usuarios PRIMARY KEY,
    codigo_verificacion NVARCHAR(255) NULL,
    codigo_verificacion_expira DATETIME2(6) NULL,
    contrasena NVARCHAR(255) NOT NULL, -- guardar hash BCrypt/Argon2, nunca texto plano
    correo NVARCHAR(255) NOT NULL,
    correo_verificado BIT NOT NULL CONSTRAINT DF_usuarios_correo_verificado DEFAULT (0),
    estado BIT NOT NULL CONSTRAINT DF_usuarios_estado DEFAULT (1),
    fecha_registro DATETIME2(6) NOT NULL CONSTRAINT DF_usuarios_fecha_registro DEFAULT (SYSUTCDATETIME()),
    nombre NVARCHAR(150) NOT NULL,
    notificaciones_email BIT NOT NULL CONSTRAINT DF_usuarios_notif_email DEFAULT (1),
    notificaciones_recordatorio BIT NOT NULL CONSTRAINT DF_usuarios_notif_recordatorio DEFAULT (1),
    rol VARCHAR(20) NOT NULL CONSTRAINT DF_usuarios_rol DEFAULT ('USUARIO'),
    CONSTRAINT UQ_usuarios_correo UNIQUE (correo),
    CONSTRAINT CK_usuarios_rol CHECK (rol IN ('ADMINISTRADOR','ORGANIZADOR','USUARIO','VISITANTE'))
);
GO

/* 2. Categorías */
CREATE TABLE dbo.categorias (
    id_categoria BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categorias PRIMARY KEY,
    descripcion NVARCHAR(500) NULL,
    estado BIT NOT NULL CONSTRAINT DF_categorias_estado DEFAULT (1),
    nombre NVARCHAR(120) NOT NULL,
    CONSTRAINT UQ_categorias_nombre UNIQUE (nombre)
);
GO

/* 3. Perfil adicional de organizador: máximo un perfil por usuario */
CREATE TABLE dbo.organizadores (
    id_organizador BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_organizadores PRIMARY KEY,
    facebook NVARCHAR(500) NULL,
    instagram NVARCHAR(500) NULL,
    nombre NVARCHAR(150) NULL,
    otras_redes NVARCHAR(1000) NULL,
    telefono NVARCHAR(30) NULL,
    whatsapp NVARCHAR(30) NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT UQ_organizadores_usuario UNIQUE (id_usuario),
    CONSTRAINT FK_organizadores_usuarios FOREIGN KEY (id_usuario)
        REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 4. Eventos */
CREATE TABLE dbo.eventos (
    id_evento BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_eventos PRIMARY KEY,
    artistas NVARCHAR(500) NULL,
    capacidad INT NOT NULL,
    ciudad NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(MAX) NULL,
    destacado BIT NOT NULL CONSTRAINT DF_eventos_destacado DEFAULT (0),
    direccion NVARCHAR(300) NOT NULL,
    entradas_disponibles INT NOT NULL,
    estado VARCHAR(30) NOT NULL CONSTRAINT DF_eventos_estado DEFAULT ('PENDIENTE_DE_VALIDACION'),
    fecha DATE NOT NULL,
    fecha_creacion DATETIME2(6) NOT NULL CONSTRAINT DF_eventos_fecha_creacion DEFAULT (SYSUTCDATETIME()),
    hora TIME(0) NOT NULL,
    imagen NVARCHAR(1000) NULL,
    latitud DECIMAL(9,6) NULL,
    longitud DECIMAL(9,6) NULL,
    lugar NVARCHAR(200) NOT NULL,
    nombre NVARCHAR(200) NOT NULL,
    visibilidad BIT NOT NULL CONSTRAINT DF_eventos_visibilidad DEFAULT (0),
    id_categoria BIGINT NOT NULL,
    id_organizador BIGINT NOT NULL,
    CONSTRAINT CK_eventos_estado CHECK (estado IN
        ('AGOTADO','ARCHIVADO','BORRADOR','ELIMINADO','FINALIZADO','PENDIENTE_DE_VALIDACION','PUBLICADO')),
    CONSTRAINT CK_eventos_capacidad CHECK (capacidad >= 0),
    CONSTRAINT CK_eventos_entradas CHECK (entradas_disponibles >= 0 AND entradas_disponibles <= capacidad),
    CONSTRAINT CK_eventos_latitud CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
    CONSTRAINT CK_eventos_longitud CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),
    CONSTRAINT FK_eventos_categorias FOREIGN KEY (id_categoria)
        REFERENCES dbo.categorias(id_categoria),
    CONSTRAINT FK_eventos_organizadores FOREIGN KEY (id_organizador)
        REFERENCES dbo.organizadores(id_organizador)
);
GO

/* 5. Asistencias: una asistencia activa por usuario y evento */
CREATE TABLE dbo.asistencias (
    id_asistencia BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_asistencias PRIMARY KEY,
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_asistencias_fecha DEFAULT (SYSUTCDATETIME()),
    id_evento BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT UQ_asistencias_usuario_evento UNIQUE (id_usuario, id_evento),
    CONSTRAINT FK_asistencias_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_asistencias_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 6. Auditoría de acciones administrativas y operativas */
CREATE TABLE dbo.auditorias (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auditorias PRIMARY KEY,
    accion NVARCHAR(120) NOT NULL,
    detalle NVARCHAR(MAX) NULL,
    entidad NVARCHAR(120) NOT NULL,
    entidad_id BIGINT NULL,
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_auditorias_fecha DEFAULT (SYSUTCDATETIME()),
    id_usuario BIGINT NULL,
    CONSTRAINT FK_auditorias_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 7. Favoritos: una sola relación por usuario/evento */
CREATE TABLE dbo.favoritos (
    id_favorito BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_favoritos PRIMARY KEY,
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_favoritos_fecha DEFAULT (SYSUTCDATETIME()),
    id_evento BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT UQ_favoritos_usuario_evento UNIQUE (id_usuario, id_evento),
    CONSTRAINT FK_favoritos_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_favoritos_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 8. Registro histórico de interacciones para analítica */
CREATE TABLE dbo.interaccion_evento (
    id_interaccion BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_interaccion_evento PRIMARY KEY,
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_interaccion_fecha DEFAULT (SYSUTCDATETIME()),
    tipo_interaccion VARCHAR(40) NOT NULL,
    id_evento BIGINT NOT NULL,
    id_usuario BIGINT NULL, -- NULL permite registrar visitas anónimas
    CONSTRAINT CK_interaccion_tipo CHECK (tipo_interaccion IN
        ('VISUALIZACION','FAVORITO','ASISTENCIA','COMPARTIDO','CLIC_WHATSAPP','CLIC_LLAMADA','CLIC_MAPA')),
    CONSTRAINT FK_interaccion_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_interaccion_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 9. Intereses del usuario por categoría */
CREATE TABLE dbo.interes_usuario (
    id_interes BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_interes_usuario PRIMARY KEY,
    nivel_interes TINYINT NOT NULL CONSTRAINT DF_interes_nivel DEFAULT (1),
    id_categoria BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT CK_interes_nivel CHECK (nivel_interes BETWEEN 1 AND 5),
    CONSTRAINT UQ_interes_usuario_categoria UNIQUE (id_usuario, id_categoria),
    CONSTRAINT FK_interes_categorias FOREIGN KEY (id_categoria) REFERENCES dbo.categorias(id_categoria),
    CONSTRAINT FK_interes_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 10. Métricas agregadas por evento */
CREATE TABLE dbo.metrica_evento (
    id_metrica BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_metrica_evento PRIMARY KEY,
    asistencias BIGINT NOT NULL CONSTRAINT DF_metrica_asistencias DEFAULT (0),
    clics_llamada BIGINT NOT NULL CONSTRAINT DF_metrica_llamada DEFAULT (0),
    clics_whatsapp BIGINT NOT NULL CONSTRAINT DF_metrica_whatsapp DEFAULT (0),
    compartidos BIGINT NOT NULL CONSTRAINT DF_metrica_compartidos DEFAULT (0),
    favoritos BIGINT NOT NULL CONSTRAINT DF_metrica_favoritos DEFAULT (0),
    fecha_actualizacion DATETIME2(6) NOT NULL CONSTRAINT DF_metrica_fecha DEFAULT (SYSUTCDATETIME()),
    visualizaciones BIGINT NOT NULL CONSTRAINT DF_metrica_visualizaciones DEFAULT (0),
    id_evento BIGINT NOT NULL,
    CONSTRAINT UQ_metrica_evento UNIQUE (id_evento),
    CONSTRAINT CK_metrica_no_negativa CHECK
        (asistencias >= 0 AND clics_llamada >= 0 AND clics_whatsapp >= 0
         AND compartidos >= 0 AND favoritos >= 0 AND visualizaciones >= 0),
    CONSTRAINT FK_metrica_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento)
);
GO

/* 11. Notificaciones y resultado de envío */
CREATE TABLE dbo.notificaciones (
    id_notificacion BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notificaciones PRIMARY KEY,
    enviado BIT NOT NULL CONSTRAINT DF_notif_enviado DEFAULT (0),
    error_envio NVARCHAR(1000) NULL,
    fecha_envio DATETIME2(6) NULL,
    leido BIT NOT NULL CONSTRAINT DF_notif_leido DEFAULT (0),
    mensaje NVARCHAR(1000) NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    id_evento BIGINT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT CK_notif_tipo CHECK (tipo IN
        ('SISTEMA','RECORDATORIO','VALIDACION','EVENTO','MARKETING','SEGURIDAD')),
    CONSTRAINT FK_notificaciones_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_notificaciones_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 12. Reportes enviados por usuarios */
CREATE TABLE dbo.reportes (
    id_reporte BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reportes PRIMARY KEY,
    descripcion NVARCHAR(1000) NULL,
    estado VARCHAR(20) NOT NULL CONSTRAINT DF_reportes_estado DEFAULT ('PENDIENTE'),
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_reportes_fecha DEFAULT (SYSUTCDATETIME()),
    motivo NVARCHAR(200) NOT NULL,
    id_evento BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT CK_reportes_estado CHECK (estado IN ('PENDIENTE','EN_REVISION','RESUELTO','RECHAZADO')),
    CONSTRAINT FK_reportes_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_reportes_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* 13. Valoraciones posteriores al evento */
CREATE TABLE dbo.valoraciones (
    id_valoracion BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_valoraciones PRIMARY KEY,
    comentario NVARCHAR(2000) NULL,
    fecha DATETIME2(6) NOT NULL CONSTRAINT DF_valoraciones_fecha DEFAULT (SYSUTCDATETIME()),
    puntuacion TINYINT NOT NULL,
    id_evento BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    CONSTRAINT CK_valoraciones_puntuacion CHECK (puntuacion BETWEEN 1 AND 5),
    CONSTRAINT UQ_valoraciones_usuario_evento UNIQUE (id_usuario, id_evento),
    CONSTRAINT FK_valoraciones_eventos FOREIGN KEY (id_evento) REFERENCES dbo.eventos(id_evento),
    CONSTRAINT FK_valoraciones_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
);
GO

/* Índices para consultas frecuentes */
CREATE INDEX IX_eventos_publicacion_fecha ON dbo.eventos(estado, visibilidad, fecha) INCLUDE (nombre, ciudad, id_categoria);
CREATE INDEX IX_eventos_ciudad_fecha ON dbo.eventos(ciudad, fecha);
CREATE INDEX IX_eventos_categoria_fecha ON dbo.eventos(id_categoria, fecha);
CREATE INDEX IX_interaccion_evento_fecha ON dbo.interaccion_evento(id_evento, fecha, tipo_interaccion);
CREATE INDEX IX_notificaciones_usuario_leido ON dbo.notificaciones(id_usuario, leido, fecha_envio);
CREATE INDEX IX_reportes_estado_fecha ON dbo.reportes(estado, fecha);
CREATE INDEX IX_auditorias_fecha ON dbo.auditorias(fecha);
GO

/* Datos iniciales de categorías. No se insertan cuentas con contraseñas de ejemplo. */
IF NOT EXISTS (SELECT 1 FROM dbo.categorias)
BEGIN
    INSERT INTO dbo.categorias (nombre, descripcion, estado) VALUES
    (N'Música y conciertos', N'Conciertos, recitales y presentaciones musicales', 1),
    (N'Cultura y tradición', N'Actividades culturales y tradicionales', 1),
    (N'Deportes', N'Competiciones y actividades deportivas', 1),
    (N'Gastronomía', N'Ferias gastronómicas y experiencias culinarias', 1),
    (N'Ferias', N'Ferias comerciales, artesanales y temáticas', 1),
    (N'Educación', N'Talleres, charlas y actividades formativas', 1),
    (N'Emprendimiento', N'Negocios, innovación y emprendimiento', 1),
    (N'Eventos familiares', N'Actividades recreativas para familias', 1),
    (N'Arte', N'Exposiciones y expresiones artísticas', 1),
    (N'Fiestas y festividades', N'Celebraciones y festividades', 1),
    (N'Otros', N'Categorías no incluidas en las anteriores', 1);
END;
GO

/* Comprobación rápida de instalación */
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
GO
