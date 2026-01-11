--
-- PostgreSQL database dump
--

\restrict UddJhvJjoDgdSpTZMRswZzgrCAEzWY17cCtFS5ft5XFX4lutTNM04eoq71L7hZF

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: debug_limpiar_usuarios_eliminados(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.debug_limpiar_usuarios_eliminados() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Log detallado del trigger
  RAISE NOTICE '🔍 TRIGGER limpiar_usuarios_eliminados ACTIVADO';
  RAISE NOTICE '   OLD.correo: %', OLD.correo;
  RAISE NOTICE '   OLD.estado: %', OLD.estado;
  RAISE NOTICE '   NEW.estado: %', NEW.estado;
  RAISE NOTICE '   Patrón _eliminado_: %', OLD.correo LIKE '%_eliminado_%';

  -- Elimina físicamente si detecta el patrón _eliminado_ en el correo
  IF OLD.correo LIKE '%_eliminado_%' THEN
    RAISE NOTICE '⚠️  ELIMINANDO USUARIO POR PATRÓN _eliminado_';
    DELETE FROM usuarios WHERE id = OLD.id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '✅ TRIGGER limpiar_usuarios_eliminados: PASANDO SIN MODIFICAR';
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.debug_limpiar_usuarios_eliminados() OWNER TO postgres;

--
-- Name: limpiar_usuarios_eliminados(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.limpiar_usuarios_eliminados() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Elimina físicamente si detecta el patrón _eliminado_ en el correo
  IF OLD.correo LIKE '%_eliminado_%' THEN
    DELETE FROM usuarios WHERE id = OLD.id;
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.limpiar_usuarios_eliminados() OWNER TO postgres;

--
-- Name: sync_usuario_estado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_usuario_estado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Log para debugging
    RAISE NOTICE 'TRIGGER: OLD.estado=%, OLD.activo=%, NEW.estado=%, NEW.activo=%',
                 OLD.estado, OLD.activo, NEW.estado, NEW.activo;

    -- Solo procesar si alguno de los campos cambió
    IF (NEW.estado IS DISTINCT FROM OLD.estado) OR
       (NEW.activo IS DISTINCT FROM OLD.activo) THEN

        RAISE NOTICE 'TRIGGER: Campos cambiaron, procesando...';

        -- PRIMERO: Si cambió el estado, sincronizar activo
        IF NEW.estado IS DISTINCT FROM OLD.estado THEN
            CASE NEW.estado
                WHEN 'activo' THEN
                    NEW.activo = true;
                    RAISE NOTICE 'TRIGGER: Estado cambió a activo, NEW.activo = true';
                WHEN 'inactivo', 'suspendido', 'bloqueado', 'eliminado' THEN
                    NEW.activo = false;
                    RAISE NOTICE 'TRIGGER: Estado cambió a inactivo/bloqueado, NEW.activo = false';
                ELSE
                    -- Para otros estados, no cambiar activo
                    RAISE NOTICE 'TRIGGER: Estado cambió a %, manteniendo activo=%', NEW.estado, NEW.activo;
            END CASE;
        END IF;

        -- SEGUNDO: Si cambió activo (y no fue por el cambio de estado arriba), sincronizar estado
        IF NEW.activo IS DISTINCT FROM OLD.activo AND
           NOT (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            IF NEW.activo = true THEN
                NEW.estado = 'activo';
                RAISE NOTICE 'TRIGGER: Activo cambió a true, NEW.estado = activo';
            ELSE
                NEW.estado = 'inactivo';
                RAISE NOTICE 'TRIGGER: Activo cambió a false, NEW.estado = inactivo';
            END IF;
        END IF;
    END IF;

    RAISE NOTICE 'TRIGGER: FINAL - NEW.estado=%, NEW.activo=%', NEW.estado, NEW.activo;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_usuario_estado() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_point; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_point (
    id integer NOT NULL,
    ip character varying(15),
    ubicacion character varying(100) NOT NULL,
    serial character varying(50),
    modelo character varying(50),
    version character varying(20),
    arquitectura character varying(20),
    mac character varying(20),
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observacion text,
    id_usuarios_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.access_point OWNER TO postgres;

--
-- Name: access_point_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.access_point_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.access_point_id_seq OWNER TO postgres;

--
-- Name: access_point_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.access_point_id_seq OWNED BY public.access_point.id;


--
-- Name: asistencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencias (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    tipo character varying(10) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    foto_path character varying(500),
    ip_origen character varying(50),
    user_agent character varying(500),
    registrante_id integer,
    registrante_nombre character varying(255),
    registrante_role character varying(50),
    CONSTRAINT asistencias_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying])::text[])))
);


ALTER TABLE public.asistencias OWNER TO postgres;

--
-- Name: asistencias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencias_id_seq OWNER TO postgres;

--
-- Name: asistencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencias_id_seq OWNED BY public.asistencias.id;


--
-- Name: etiquetadoras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etiquetadoras (
    id integer NOT NULL,
    ip character varying(15),
    ubicacion character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    serial character varying(50),
    modelo character varying(50),
    serial_aplicador character varying(50),
    mac character varying(17),
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observaciones text,
    id_usuarios_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.etiquetadoras OWNER TO postgres;

--
-- Name: etiquetadoras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etiquetadoras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etiquetadoras_id_seq OWNER TO postgres;

--
-- Name: etiquetadoras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etiquetadoras_id_seq OWNED BY public.etiquetadoras.id;


--
-- Name: historial_estados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historial_estados (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    administrador_id integer,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.historial_estados OWNER TO postgres;

--
-- Name: historial_estados_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historial_estados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historial_estados_id_seq OWNER TO postgres;

--
-- Name: historial_estados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historial_estados_id_seq OWNED BY public.historial_estados.id;


--
-- Name: horarios_calendario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.horarios_calendario (
    id integer NOT NULL,
    mes integer NOT NULL,
    anio integer NOT NULL,
    datos_calendario jsonb NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_usuario_creo integer,
    orden_tecnicos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.horarios_calendario OWNER TO postgres;

--
-- Name: horarios_calendario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.horarios_calendario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.horarios_calendario_id_seq OWNER TO postgres;

--
-- Name: horarios_calendario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.horarios_calendario_id_seq OWNED BY public.horarios_calendario.id;


--
-- Name: lectores_qr; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lectores_qr (
    id integer NOT NULL,
    ubicacion character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    modelo character varying(50) NOT NULL,
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observaciones text,
    id_usuarios_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.lectores_qr OWNER TO postgres;

--
-- Name: lectores_qr_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lectores_qr_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lectores_qr_id_seq OWNER TO postgres;

--
-- Name: lectores_qr_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lectores_qr_id_seq OWNED BY public.lectores_qr.id;


--
-- Name: logs_auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logs_auditoria (
    id integer NOT NULL,
    usuario_id integer,
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id integer,
    detalles text,
    ip_address character varying(45),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs_auditoria OWNER TO postgres;

--
-- Name: logs_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.logs_auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.logs_auditoria_id_seq OWNER TO postgres;

--
-- Name: logs_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.logs_auditoria_id_seq OWNED BY public.logs_auditoria.id;


--
-- Name: mantenimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mantenimientos (
    id integer NOT NULL,
    id_usuarios integer,
    tipo character varying(50) NOT NULL,
    fecha date NOT NULL,
    id_dispositivo integer,
    id_repuesto integer,
    descripcion text,
    observaciones text,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    estado character varying(20) DEFAULT 'Pendiente'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    dispositivo_tipo character varying(20),
    CONSTRAINT mantenimientos_estado_check CHECK (((estado)::text = ANY ((ARRAY['Pendiente'::character varying, 'En Progreso'::character varying, 'Completado'::character varying, 'Cancelado'::character varying])::text[])))
);


ALTER TABLE public.mantenimientos OWNER TO postgres;

--
-- Name: mantenimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mantenimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mantenimientos_id_seq OWNER TO postgres;

--
-- Name: mantenimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mantenimientos_id_seq OWNED BY public.mantenimientos.id;


--
-- Name: ordenadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ordenadores (
    id integer NOT NULL,
    ip character varying(15),
    ubicacion character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    serial character varying(50),
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observaciones text,
    id_usuario_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    marca character varying(50),
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.ordenadores OWNER TO postgres;

--
-- Name: ordenadores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ordenadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ordenadores_id_seq OWNER TO postgres;

--
-- Name: ordenadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ordenadores_id_seq OWNED BY public.ordenadores.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: readers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.readers (
    id integer NOT NULL,
    ip character varying(15),
    ubicacion character varying(100) NOT NULL,
    no_maquina character varying(50),
    serial character varying(50),
    mac character varying(17),
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observaciones text,
    id_usuario_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.readers OWNER TO postgres;

--
-- Name: readers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.readers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.readers_id_seq OWNER TO postgres;

--
-- Name: readers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.readers_id_seq OWNED BY public.readers.id;


--
-- Name: repuestos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repuestos (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    proceso character varying(50),
    descripcion text,
    codigo character varying(50) NOT NULL,
    codigo_siesa character varying(50),
    cantidad integer DEFAULT 0,
    rotacion character varying(20) DEFAULT 'Media'::character varying,
    stock_minimo integer DEFAULT 5,
    fecha_ingreso date NOT NULL,
    ubicacion character varying(100),
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50)
);


ALTER TABLE public.repuestos OWNER TO postgres;

--
-- Name: repuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repuestos_id_seq OWNER TO postgres;

--
-- Name: repuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repuestos_id_seq OWNED BY public.repuestos.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: tablets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tablets (
    id integer NOT NULL,
    ip character varying(15),
    ubicacion character varying(100) NOT NULL,
    no_maquina character varying(50),
    activo boolean DEFAULT true,
    serial character varying(50),
    estado character varying(20) DEFAULT 'Activo'::character varying,
    fecha_ingreso date NOT NULL,
    observaciones text,
    id_usuario_responsable integer,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trial186 character varying(50),
    activo_fijo character varying(50)
);


ALTER TABLE public.tablets OWNER TO postgres;

--
-- Name: tablets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tablets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tablets_id_seq OWNER TO postgres;

--
-- Name: tablets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tablets_id_seq OWNED BY public.tablets.id;


--
-- Name: tecnicos_horarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tecnicos_horarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#007bff'::character varying,
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tecnicos_horarios OWNER TO postgres;

--
-- Name: tecnicos_horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tecnicos_horarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tecnicos_horarios_id_seq OWNER TO postgres;

--
-- Name: tecnicos_horarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tecnicos_horarios_id_seq OWNED BY public.tecnicos_horarios.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    cedula character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    correo character varying(100) NOT NULL,
    contrasena character varying(255) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    role character varying(20) DEFAULT 'user'::character varying,
    id_usuario_responsable integer,
    activo boolean DEFAULT true,
    deleted_at timestamp without time zone,
    deleted_by integer,
    estado character varying(20) DEFAULT 'activo'::character varying,
    fecha_expiracion_suspension timestamp without time zone,
    fecha_bloqueo timestamp without time zone,
    CONSTRAINT check_correo_format CHECK (((correo)::text ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text)),
    CONSTRAINT check_fechas_validas CHECK ((((fecha_expiracion_suspension IS NULL) OR (fecha_expiracion_suspension > fecha_registro)) AND ((fecha_bloqueo IS NULL) OR (fecha_bloqueo > fecha_registro)) AND ((deleted_at IS NULL) OR (deleted_at >= fecha_registro)))),
    CONSTRAINT check_role_valido CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying, 'supervisor'::character varying, 'auditor'::character varying, 'empleado'::character varying])::text[]))),
    CONSTRAINT chk_estado CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'suspendido'::character varying, 'bloqueado'::character varying, 'pendiente'::character varying, 'eliminado'::character varying])::text[])))
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: access_point id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_point ALTER COLUMN id SET DEFAULT nextval('public.access_point_id_seq'::regclass);


--
-- Name: asistencias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias ALTER COLUMN id SET DEFAULT nextval('public.asistencias_id_seq'::regclass);


--
-- Name: etiquetadoras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetadoras ALTER COLUMN id SET DEFAULT nextval('public.etiquetadoras_id_seq'::regclass);


--
-- Name: historial_estados id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_estados ALTER COLUMN id SET DEFAULT nextval('public.historial_estados_id_seq'::regclass);


--
-- Name: horarios_calendario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios_calendario ALTER COLUMN id SET DEFAULT nextval('public.horarios_calendario_id_seq'::regclass);


--
-- Name: lectores_qr id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectores_qr ALTER COLUMN id SET DEFAULT nextval('public.lectores_qr_id_seq'::regclass);


--
-- Name: logs_auditoria id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_auditoria ALTER COLUMN id SET DEFAULT nextval('public.logs_auditoria_id_seq'::regclass);


--
-- Name: mantenimientos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mantenimientos ALTER COLUMN id SET DEFAULT nextval('public.mantenimientos_id_seq'::regclass);


--
-- Name: ordenadores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenadores ALTER COLUMN id SET DEFAULT nextval('public.ordenadores_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: readers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.readers ALTER COLUMN id SET DEFAULT nextval('public.readers_id_seq'::regclass);


--
-- Name: repuestos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repuestos ALTER COLUMN id SET DEFAULT nextval('public.repuestos_id_seq'::regclass);


--
-- Name: tablets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tablets ALTER COLUMN id SET DEFAULT nextval('public.tablets_id_seq'::regclass);


--
-- Name: tecnicos_horarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos_horarios ALTER COLUMN id SET DEFAULT nextval('public.tecnicos_horarios_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: access_point; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.access_point (id, ip, ubicacion, serial, modelo, version, arquitectura, mac, estado, fecha_ingreso, observacion, id_usuarios_responsable, fecha_actualizacion, trial186, activo_fijo) FROM stdin;
1	10.3.24.201	Elevador 101	BED709E7B585	RBwAPR-2nD	v6.49.18	mipsbe	C4.AD.34.7C.39.5B	Activo	2025-10-31	\N	2	2025-10-31 23:59:26.879359	\N	\N
2	10.3.24.202	Montacargas 102	HDA08A4Y079	RBwAPG-5HacD2HnD	v6..49.18	arm	18:FD:74:CE:A0:DD	Activo	2025-11-01	\N	2	2025-11-01 00:03:49.035853	\N	\N
4	10.3.24.204	Elevador 104	HDA081EV73E	RBwAPG-5HacD2HnD	v6.49.18	arm	18:fd:74:ce:9e:ca	Activo	2025-11-01	\N	2	2025-11-01 00:09:50.887723	\N	\N
5	10.3.24.205	Elevador 105		RBwAPG-5HacD2HnD	v6.49.18	arm	18:FD:74:CE:9B:84	Activo	2025-11-01	\N	2	2025-11-01 00:15:32.035976	\N	\N
6	10.3.24.206	Montacargas 106	HCQ082HJDSQ	BRwAPG-5HacD2HnD	v6.49.18	arm	18:FD:74:30:55:B6	Activo	2025-11-01	\N	2	2025-11-01 00:19:18.819851	\N	\N
7	10.3.24.207	Elevador 107	A631091142DD	RouterBOARD wAP G-5Hac T2HnD	v6.49.18	mipsbe	B8:69:F4:F4:DDB2	Activo	2025-11-01	\N	2	2025-11-01 00:23:01.669931	\N	\N
8	10.3.24.208	Elevador 108	HCQ0887H42T	RBwAPG-5HacD2HnD	v6.49.18	arm	18:FD:74:30:55:83	Activo	2025-11-01	\N	2	2025-11-01 00:25:47.462922	\N	\N
9	10.3.24.209	Montacargas 109	HDA08DBY789	\N	\N	\N	18:FD:74:CE:6F:9E	Activo	2025-11-01	\N	2	2025-11-01 00:27:41.608108	\N	\N
10	10.3.24.210	Montacargas 110	HDE087B55P0	RBwAPR-2nD	v6.49.18	mipsbe	18:FD:74:F9:C2:5B	Activo	2025-11-01	\N	2	2025-11-01 00:30:24.080006	\N	\N
11	10.3.24.211	Montacargas 111	HCQ08DXVQX3	\N	\N	\N	18:FD:74:30:5D:70	Activo	2025-11-01	\N	2	2025-11-01 00:32:39.764167	\N	\N
12	10.3.24.212	Montacargas 112	HDA08DVGBYD	\N	\N	\N	18:FD:74:CE:A2:46	Activo	2025-11-01	\N	2	2025-11-01 00:34:23.474444	\N	\N
13	10.3.24.213	Elevador 113	HE108G2WRMM	\N	\N	\N	48:A9:8A:36:6B:C5	Activo	2025-11-01	\N	2	2025-11-01 00:35:50.459217	\N	\N
14	10.3.24.213	Elevador  114	7DF2094BE63C	RBwAPG-5HacD2HnD	v6.49.18	arm	B8:69:F4:3A:F9:A3	Activo	2025-11-01	\N	2	2025-11-01 00:38:12.444187	\N	\N
15	10.3.24.215	Elevador 115	HCQ085FPG2C	RBwAPG-5HacD2HnD	v6.49.18	arm	18:FD:74:35:1B:A4	Activo	2025-11-01	\N	2	2025-11-01 00:40:43.808536	\N	\N
17	10.3.24.220	Impresora Despacho	BED60B75CA11	\N	\N	\N	\N	Activo	2025-11-01	\N	2	2025-11-01 00:43:12.066458	\N	\N
16	10.3.24.216	Estibador 116	\N	\N	\N	\N	\N	Activo	2025-11-01	\N	2	2025-11-01 00:41:36.870144	\N	No Tiene
3	10.3.24.203	Royal 103	\N	\N	\N	\N	\N	Activo	2025-11-01	\N	2	2025-11-01 00:06:07.216816	\N	No Tiene
\.


--
-- Data for Name: asistencias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asistencias (id, usuario_id, tipo, fecha, foto_path, ip_origen, user_agent, registrante_id, registrante_nombre, registrante_role) FROM stdin;
1	2	entrada	2025-12-02 07:13:59.502495-05	/uploads/asistencias/2_1764677639495_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
2	2	entrada	2025-12-02 07:18:39.508205-05	/uploads/asistencias/2_1764677919504_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
3	2	salida	2025-12-02 07:19:50.757378-05	/uploads/asistencias/2_1764677990753_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
4	2	entrada	2025-12-02 07:42:22.501048-05	/uploads/asistencias/2_1764679342494_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
5	13	entrada	2025-12-02 07:43:19.811503-05	/uploads/asistencias/13_1764679399806_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
6	13	salida	2025-12-02 07:44:29.055838-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
7	13	entrada	2025-12-02 09:04:45.300579-05	/uploads/asistencias/13_1764684285297_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
8	13	salida	2025-12-02 09:05:22.061699-05	/uploads/asistencias/13_1764684322057_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
9	13	entrada	2025-12-02 19:54:06.918064-05	/uploads/asistencias/13_1764723246912_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
10	13	salida	2025-12-02 19:54:23.309889-05	/uploads/asistencias/13_1764723263307_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
11	2	entrada	2025-12-02 20:09:34.767178-05	/uploads/asistencias/2_1764724174762_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
12	2	salida	2025-12-02 20:09:48.727279-05	/uploads/asistencias/2_1764724188724_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
13	2	entrada	2025-12-02 20:11:55.37843-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
14	13	entrada	2025-12-02 20:12:23.533006-05	/uploads/asistencias/13_1764724343528_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
15	13	salida	2025-12-02 20:12:34.423723-05	/uploads/asistencias/13_1764724354420_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
16	13	entrada	2025-12-03 05:39:27.654715-05	/uploads/asistencias/13_1764758367618_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
17	13	salida	2025-12-03 05:39:36.846521-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
18	2	entrada	2025-12-03 05:40:52.043915-05	/uploads/asistencias/2_1764758452040_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
19	2	salida	2025-12-03 05:41:03.479247-05	/uploads/asistencias/2_1764758463474_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
20	2	entrada	2025-12-03 06:16:46.852706-05	/uploads/asistencias/2_1764760606848_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
21	2	salida	2025-12-03 06:16:58.494503-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
22	13	entrada	2025-12-03 06:17:43.461417-05	/uploads/asistencias/13_1764760663458_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
23	13	salida	2025-12-03 06:18:06.442752-05	/uploads/asistencias/13_1764760686439_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
24	13	entrada	2025-12-03 06:19:37.859579-05	/uploads/asistencias/13_1764760777854_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
25	13	salida	2025-12-03 06:19:57.642824-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
26	13	entrada	2025-12-03 06:22:02.812908-05	/uploads/asistencias/13_1764760922807_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
27	13	entrada	2025-12-03 07:37:04.595944-05	/uploads/asistencias/13_1764765424590_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
28	13	salida	2025-12-03 07:37:18.949449-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
29	2	entrada	2025-12-03 07:37:53.062587-05	/uploads/asistencias/2_1764765473058_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
30	2	salida	2025-12-03 07:38:09.25333-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
31	2	entrada	2025-12-03 07:39:14.456697-05	/uploads/asistencias/2_1764765554450_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
32	2	salida	2025-12-03 07:39:25.991412-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
33	13	entrada	2025-12-03 07:39:44.119014-05	/uploads/asistencias/13_1764765584116_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
34	13	salida	2025-12-03 07:40:06.258579-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
35	2	entrada	2025-12-03 07:41:41.126595-05	/uploads/asistencias/2_1764765701123_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
36	2	salida	2025-12-03 07:42:56.664204-05	/uploads/asistencias/2_1764765776660_foto.jpg	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
37	2	entrada	2025-12-03 07:43:08.032932-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
38	2	salida	2025-12-03 08:05:32.416612-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
39	13	entrada	2025-12-03 08:06:16.44219-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	13	juan ruiz	user
40	2	entrada	2025-12-03 16:44:01.97753-05	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	2	jose raul ruiz	admin
41	2	salida	2025-12-03 16:44:25.609399-05	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	2	jose raul ruiz	admin
42	2	entrada	2025-12-03 16:45:56.546736-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
43	2	salida	2025-12-03 16:46:10.457263-05	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2	jose raul ruiz	admin
\.


--
-- Data for Name: etiquetadoras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etiquetadoras (id, ip, ubicacion, activo, serial, modelo, serial_aplicador, mac, estado, fecha_ingreso, observaciones, id_usuarios_responsable, fecha_actualizacion, trial186, activo_fijo) FROM stdin;
2	10.3.24.81	Linea #2	t	\N	ZE500	GAB2025-3	00:07:4D:80:34:77	Activo	2025-11-01	\N	2	2025-10-31 23:29:41.735624	\N	0804
3	10.3.24.82	Linea #3	t	\N	ZE500	10	00:07:4D:80:34:1C	Activo	2025-11-01	\N	2	2025-10-31 23:33:02.442577	\N	0802
5	10.3.24.84	Linea #5	t	\N	ZE500	GAB2025-7	00:07:4D:7E:E8:C2	Activo	2025-10-31	\N	2	2025-10-31 23:36:15.03522	\N	0819
10	10.3.24.90	Linea #10	t	\N	ZE500	Pas1-ze511-20233	00:07:4d:85:a0:a2	Activo	2025-10-31	\N	2	2025-10-31 23:43:40.812215	\N	0811
7	10.3.24.86	Duplex #1	t	\N	ZE500	GAB2025-6	00:07:4D:80:34:0B	Activo	2025-10-31	\N	2	2025-10-31 23:39:06.429167	\N	0800
1	10.3.24.80	Linea #1	t	\N	ZE500	GAB2025-2	00:07:4def:01:76	Activo	2025-10-31		2	2025-10-31 23:46:01.231906	\N	 0803
4	10.3.24.83	Linea #4	t	\N	ZE500	GAB2025-1	00:07:4D:85:85:C5	Activo	2025-10-31	\N	2	2025-10-31 23:34:49.754899	\N	0806
6	10.3.24.85	Linea #6	t	\N	ZE511	GAB2025-4	60:95:32:36:DF:38	Activo	2025-10-31	\N	2	2025-10-31 23:37:41.15424	\N	0817
11	10.3.24.91	Linea #0	t	\N	ZE500	GAB2025-9	00:07:4D:80:34:4A	Activo	2025-10-31	\N	2	2025-10-31 23:45:02.88833	\N	0818
8	10.3.24.89	Duplex #2	t	\N	ZE500	\N	00:07:4D:EF:03:4N	Activo	2025-10-31	\N	2	2025-10-31 23:40:26.06138	\N	0809
9	10.3.24.87	Duplex  #3	t	\N	ZE500	PAS1W100 2025-5	00:07:4D:CB:B6:8E	Activo	2025-10-31	\N	2	2025-10-31 23:41:59.61799	\N	0805
\.


--
-- Data for Name: historial_estados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.historial_estados (id, usuario_id, estado_anterior, estado_nuevo, motivo, administrador_id, fecha) FROM stdin;
\.


--
-- Data for Name: horarios_calendario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.horarios_calendario (id, mes, anio, datos_calendario, fecha_creacion, fecha_actualizacion, id_usuario_creo, orden_tecnicos) FROM stdin;
1	12	2025	{"mes": 12, "anio": 2025, "semanas": [[{"dia": 1, "filas": [{"turno": "Apoyo", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Descanso", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Lunes", "fechaCompleta": "2025-12-01"}, {"dia": 2, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Martes", "fechaCompleta": "2025-12-02"}, {"dia": 3, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Miércoles", "fechaCompleta": "2025-12-03"}, {"dia": 4, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Jueves", "fechaCompleta": "2025-12-04"}, {"dia": 5, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Viernes", "fechaCompleta": "2025-12-05"}, {"dia": 6, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Adriana B."}], "nombreDia": "Sábado", "fechaCompleta": "2025-12-06"}], [{"dia": 7, "filas": [{"turno": "Descanso", "tecnico": "Juan Vargas"}, {"turno": "Descanso", "tecnico": "Adriana B."}, {"turno": "Descanso", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Richard Prado"}], "nombreDia": "Domingo", "fechaCompleta": "2025-12-07"}, {"dia": 8, "filas": [{"turno": "Descanso", "tecnico": "Juan Vargas"}, {"turno": "Apoyo", "tecnico": "Adriana B."}, {"turno": "Descanso", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Lunes", "fechaCompleta": "2025-12-08"}, {"dia": 9, "filas": [{"turno": "5am-12pm", "tecnico": "Juan Vargas"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Martes", "fechaCompleta": "2025-12-09"}, {"dia": 10, "filas": [{"turno": "5am-12pm", "tecnico": "Juan Vargas"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Miércoles", "fechaCompleta": "2025-12-10"}, {"dia": 11, "filas": [{"turno": "5am-12pm", "tecnico": "Juan Vargas"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Jueves", "fechaCompleta": "2025-12-11"}, {"dia": 12, "filas": [{"turno": "5am-12pm", "tecnico": "Juan Vargas"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Viernes", "fechaCompleta": "2025-12-12"}, {"dia": 13, "filas": [{"turno": "5am-12pm", "tecnico": "Juan Vargas"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "Descanso", "tecnico": "Richard Prado"}], "nombreDia": "Sábado", "fechaCompleta": "2025-12-13"}], [{"dia": 14, "filas": [{"turno": "Descanso", "tecnico": "Adriana B."}, {"turno": "Descanso", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Domingo", "fechaCompleta": "2025-12-14"}, {"dia": 15, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Descanso", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Lunes", "fechaCompleta": "2025-12-15"}, {"dia": 16, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Martes", "fechaCompleta": "2025-12-16"}, {"dia": 17, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Miércoles", "fechaCompleta": "2025-12-17"}, {"dia": 18, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Jueves", "fechaCompleta": "2025-12-18"}, {"dia": 19, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "José Ruiz"}], "nombreDia": "Viernes", "fechaCompleta": "2025-12-19"}, {"dia": 20, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "Richard Prado"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "Descanso", "tecnico": "José Ruiz"}], "nombreDia": "Sábado", "fechaCompleta": "2025-12-20"}], [{"dia": 21, "filas": [{"turno": "Descanso", "tecnico": "Richard Prado"}, {"turno": "Descanso", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "Descanso", "tecnico": "Juan Vargas"}], "nombreDia": "Domingo", "fechaCompleta": "2025-12-21"}, {"dia": 22, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Descanso", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Juan Vargas"}], "nombreDia": "Lunes", "fechaCompleta": "2025-12-22"}, {"dia": 23, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Juan Vargas"}], "nombreDia": "Martes", "fechaCompleta": "2025-12-23"}, {"dia": 24, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "Descanso", "tecnico": "Juan Vargas"}], "nombreDia": "Miércoles", "fechaCompleta": "2025-12-24"}, {"dia": 25, "filas": [{"turno": "Descanso", "tecnico": "Richard Prado"}, {"turno": "Descanso", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Juan Vargas"}], "nombreDia": "Jueves", "fechaCompleta": "2025-12-25"}, {"dia": 26, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "10pm-5am", "tecnico": "Juan Vargas"}], "nombreDia": "Viernes", "fechaCompleta": "2025-12-26"}, {"dia": 27, "filas": [{"turno": "5am-12pm", "tecnico": "Richard Prado"}, {"turno": "3pm-10pm", "tecnico": "Adriana B."}, {"turno": "Apoyo", "tecnico": "José Ruiz"}, {"turno": "Descanso", "tecnico": "Juan Vargas"}], "nombreDia": "Sábado", "fechaCompleta": "2025-12-27"}], [{"dia": 28, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Domingo", "fechaCompleta": "2025-12-28"}, {"dia": 29, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Lunes", "fechaCompleta": "2025-12-29"}, {"dia": 30, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Martes", "fechaCompleta": "2025-12-30"}, {"dia": 31, "filas": [{"turno": "5am-12pm", "tecnico": "Adriana B."}, {"turno": "3pm-10pm", "tecnico": "José Ruiz"}, {"turno": "Apoyo", "tecnico": "Juan Vargas"}, {"turno": "10pm-5am", "tecnico": "Richard Prado"}], "nombreDia": "Miércoles", "fechaCompleta": "2025-12-31"}]], "fecha_actualizacion": "2025-12-01T21:58:55.248Z", "orden_tecnicos_por_semana": {"0": [3, 1, 2, 4], "1": [2, 4, 1, 3], "2": [4, 3, 2, 1], "3": [3, 4, 1, 2]}}	2025-11-28 00:08:12.981282	2025-12-01 16:58:55.291151	2	[]
\.


--
-- Data for Name: lectores_qr; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lectores_qr (id, ubicacion, activo, modelo, estado, fecha_ingreso, observaciones, id_usuarios_responsable, fecha_actualizacion, trial186, activo_fijo) FROM stdin;
\.


--
-- Data for Name: logs_auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.logs_auditoria (id, usuario_id, accion, tabla_afectada, registro_id, detalles, ip_address, fecha_creacion) FROM stdin;
1	2	UPDATE	usuarios	15	Estado cambiado a activo	::1	2026-01-05 12:33:55.285825
2	2	UPDATE	usuarios	13	Estado cambiado a bloqueado	::1	2026-01-05 12:34:11.888581
3	15	UPDATE	usuarios	13	Estado cambiado a activo	::1	2026-01-05 12:36:43.894387
4	2	UPDATE	usuarios	15	Estado cambiado a bloqueado	::1	2026-01-11 16:17:10.811108
\.


--
-- Data for Name: mantenimientos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mantenimientos (id, id_usuarios, tipo, fecha, id_dispositivo, id_repuesto, descripcion, observaciones, fecha_actualizacion, trial186, estado, updated_at, dispositivo_tipo) FROM stdin;
111	2	Correctivo	2025-11-22	5	\N	CAMBIO DE CABLE		2025-11-21 14:38:42.490436	\N	Completado	2025-11-21 14:38:42.490436	readers
110	13	Preventivo	2025-11-21	2	\N	prueba ubicación		2025-11-21 11:50:15.779581	\N	En Progreso	2025-11-24 19:28:08.999631	readers
112	2	Preventivo	2025-11-22	10	\N	nuevo		2025-11-21 23:18:43.685195	\N	Completado	2025-11-24 19:28:52.596805	etiquetadoras
109	2	Preventivo	2025-11-20	1	\N	prueba 4		2025-11-20 23:48:14.941912	\N	Pendiente	2025-11-28 18:29:45.43159	etiquetadoras
114	2	Preventivo	2025-12-01	8	29	limpieza		2025-12-01 17:00:08.938728	\N	Completado	2025-12-01 17:00:08.938728	etiquetadoras
\.


--
-- Data for Name: ordenadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ordenadores (id, ip, ubicacion, activo, serial, estado, fecha_ingreso, observaciones, id_usuario_responsable, fecha_actualizacion, marca, trial186, activo_fijo) FROM stdin;
10		Tobogan #4	t	\N	Retirado	2025-12-04		2	2025-12-04 08:53:47.158493		\N	No Tiene
11		Tobogán #14	t	\N	Retirado	2025-12-04		2	2025-12-04 08:54:04.355365		\N	No Tiene
8	10.3.24.121	Tobogan #3	t	\N	Activo	2025-12-04		2	2025-12-04 08:51:09.43219	hp	\N	No Tiene
7	10.3.24.124	Tobogan #2	t	\N	Activo	2025-12-04	\N	2	2025-12-04 08:43:46.997016	hp	\N	No Tiene
12	10.3.24.136	Tobogán #15	t	\N	Activo	2025-12-04		2	2025-12-04 08:54:19.131884		\N	No Tiene
13	10.3.24.139	Tobogán #16	t	\N	Activo	2025-12-04		2	2025-12-04 08:55:05.18201		\N	No Tiene
14	10.3.24.123	Dúplex #2	t	\N	Activo	2025-12-04		2	2025-12-04 08:55:53.737193	hp	\N	No Tiene
15	10.3.24.122	Dúplex  #3	t	\N	Activo	2025-12-04		2	2025-12-04 08:56:22.569209	hp	\N	No Tiene
1	10.3.24.123	duplex #1	t	21212123	Activo	2025-10-31		2	2025-10-31 13:47:37.790047	hp	\N	No Tiene
6	10.3.24.127	Tobogán #13	t	\N	Activo	2025-12-04	\N	2	2025-12-04 08:38:11.589406	Lenovo	\N	No Tiene
5	10.3.24.120	Tobogán #1	t	\N	Activo	2025-12-04	\N	2	2025-12-04 08:35:35.684125	Lenovo	\N	No Tiene
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token, used, used_at, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: readers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.readers (id, ip, ubicacion, no_maquina, serial, mac, estado, fecha_ingreso, observaciones, id_usuario_responsable, fecha_actualizacion, trial186, activo_fijo) FROM stdin;
7	10.3.24.107	Elevador 107	0141	18267010511489	84:24:8D:F4:3B:3D	Activo	2025-10-31	FX9600F43B3D	2	2025-10-31 23:00:58.890553	\N	0000
9	10.3.24.109	Montacargas 109	2411	23078010550027	18:FD:74:CE:6F:9E	Activo	2025-10-31	FX9600711096	2	2025-10-31 23:05:40.715333	\N	0000
12	10.3.24.112	Montacargas 112	2441	23173010557346	18:FD:74:CE:9E:FE	Activo	2025-10-31	FX750074357F	2	2025-10-31 23:11:54.096891	\N	0000
14	10.3.24.114	Elevador 114	3621	21329010553001	18:FD:74:CE:9E:E4	Activo	2025-10-31	FX96005FA41C	2	2025-10-31 23:15:46.475309	\N	0000
16	10.3.24.116	Estibador 116	6632	18345010507343	\N	Activo	2025-10-31	FX9600F69E57	2	2025-10-31 23:19:27.968031	\N	0000
11	10.3.24.111	Montacargas 111	5881	18168010508958	18:FD:74:30:5D:70	Standby	2025-10-31	FX9600F2B5AF	2	2025-11-01 16:44:13.958869	\N	0000
5	10.3.24.105	Elevador 105	9911	23173010557345	18:FD:74:CE:9B:84	Activo	2025-10-31	FX7500743598	2	2025-11-12 00:01:31.02077	\N	0820
4	10.3.24.104	Elevador 104	4311	18168010504078	18:FD:74:CE:9E:CA	Activo	2025-10-31	FX9600F2B231	2	2025-10-31 22:54:27.348109	\N	0000
10	10.3.24.110	Montacargas 110	8151	20304010557006	08:55:31:18:BB:46	Activo	2025-10-31	FX9600FCBA46	2	2025-10-31 23:07:47.696969	\N	0823
13	10.3.24.113	Elevador 113	6361	18246010509128	18:fd:74:30:55:83	Activo	2025-10-31	FX7500F3BA32	2	2025-10-31 23:13:52.380146	\N	0822
2	10.3.24.101	Elevador 101	9641	19059010507534	84:24:8D:F8:97:3B	Activo	2025-11-01	FX7500F8973B	2	2025-10-31 22:44:53.38321	\N	0827
3	10.3.24.103	Royal 103		21329010552994	0E:AC:8B:1B:BA:38	Activo	2025-11-01	FX96005FA49F	2	2025-10-31 23:56:48.125649	\N	0825
1	10.3.24.102	Montacargas 102	4556	17351010501772	18:FD:74:CE:A0:DD	Activo	2025-10-31	FX9600F05A79	2	2025-10-31 22:47:27.068408	\N	0826
6	10.3.24.106	Montacargas 106	8141	18246010509126	18:FD:74:30:55:B1	Activo	2025-10-31	FX7500F3BA1F	2	2025-10-31 22:58:49.123261	\N	0828
8	10.3.24.108	Elevador 108	1191	23173010557344	48:A9:8A:36:6B:C5	Activo	2025-10-31	FX75007435A9	2	2025-10-31 23:02:55.784267	\N	0821
15	10.3.24.115	Elevador 115	8601	18070010501299	18:FD:74:CE:9E:E4	Standby	2025-10-31	FX9600F13A7F	2	2025-11-01 16:44:26.0451	\N	0824
\.


--
-- Data for Name: repuestos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repuestos (id, nombre, proceso, descripcion, codigo, codigo_siesa, cantidad, rotacion, stock_minimo, fecha_ingreso, ubicacion, fecha_actualizacion, trial186) FROM stdin;
3	Convertidor DC-DC Buck 48V a 24V 120W	Montacargas-Elevador	\N	E20	SB-A-E20	1	Alta	5	2025-11-01	Almacen	2025-11-01 02:25:08.539353	\N
4	ANTENA:SLIM  RFIND 10.8" X 8.4" US	Montacargas-Elevador	\N	AN610-SCL711229US	SB-A-AN610	2	Alta	5	2025-11-01	Almacen	2025-11-01 02:28:12.038497	\N
5	Cargador USB doble	Montacargas-Elevador	\N	N/A	\N	0	Media	1	2025-11-01	Almacen	2025-11-01 02:30:52.959859	\N
6	COCAR/EKYLIN T122410 DC-DC CONVERTER 12V-24V	Montacargas-Elevador	\N	E21	SB-A-E21	0	Alta	2	2025-11-01	Almacen	2025-11-01 02:42:44.101833	\N
7	READER RFID ZEBRA FX9600	Montacargas-Elevador	\N	RRFID	SB-MB-RRFID	2	Baja	1	2025-11-01	Almacen	2025-11-01 02:44:29.67615	\N
9	Conversor DC  Buck LM2596 doble      	\N	\N	00	SB-A-E19	0	Media	2	2025-11-01	Almacen	2025-11-01 02:46:43.132153	\N
10	Valvula  3/2  De 1/4	Enfardado/Ensacado-Impresora Dispensadora	\N	SB-M-N13	SB-M-N13	3	Media	2	2025-11-01	Almacen	2025-11-01 02:49:30.567472	\N
11	Plc unitronics   jazz	Enfardadora/Ensacado-Impresora Dispensadora	\N	SB-B-E2	SB-B-E2	0	Baja	1	2025-11-01	Almacen	2025-11-01 02:52:05.024969	\N
12	Sensor Final De Carrera  1 Cable	Enfardado/Ensacado	\N	SB-A-N17	SB-A-N17	0	Alta	1	2025-11-01	Almacen	2025-11-01 03:12:19.205961	\N
13	Kit Printhead 203 dpi ZE511 -4-RH & LH	Enfardado/Ensacado	\N	SB-A-KPH	SB-A-KPH	2	Alta	3	2025-11-01	Almacen	2025-11-01 03:15:06.218112	\N
14	Kit Printhead 203 dpi ZE500-4 RH & LH	Enfardado/Ensacado	\N	P1046696-099	SB-A-KPH	1	Alta	4	2025-11-01	Almacen	2025-11-01 03:18:50.086183	\N
15	Kit  Pinch  &  Peel Roller ZE500-4 RH & LH	Enfardado/Ensacado	\N	P1046696-059	SB-A-KPPR	5	Alta	2	2025-11-01	Almacen	2025-11-01 03:25:38.41604	\N
16	Kit  Platen  Roller ZE500-4 RH & LH	Enfardado/Ensacado	\N	P1046696-072	SB-A-KPR	7	Alta	3	2025-11-01	Almacen	2025-11-01 03:27:21.400658	\N
17	Rodillo de bronce 	\N	\N	000	\N	3	Media	2	2025-11-01	Almacen	2025-11-01 03:28:27.82683	\N
18	Sensor Inductivo Enbobinado v1	Enfardado/Ensacado	\N	E3	SB-A-E3	2	Alta	2	2025-11-01	Almacen	2025-11-01 03:29:56.903383	\N
19	Capacitor	Enfardado/Ensacado	\N	E7	SB-A-E7	1	Alta	1	2025-11-01	Almacen	2025-11-01 03:31:02.54157	\N
20	Rele pastilla	Enfardado/Ensacado	\N	E9	SB-A-E9	1	Alta	1	2025-11-01	Almacen	2025-11-01 03:32:12.52286	\N
21	Unidad De  Mto Neumatico	Enfardado/Ensacado	\N	N19	SB-M-N19	2	Media	1	2025-11-01	Almacen	2025-11-01 03:33:16.606563	\N
22	Racor Rectos De 1/4 x 8Mm	Enfardado/Ensacado	\N	N2	SB-A-N2	1	Alta	3	2025-11-01	Almacen	2025-11-01 03:34:54.538077	\N
23	Racor Codo De 1/8 x 8Mm	Enfardado/Ensacado	\N	N4	SB-A-N4	3	Alta	3	2025-11-01	Almacen	2025-11-01 03:36:21.944612	\N
24	Pistas	Enfardado/Ensacado	\N	M31	SB-A-M31	4	Alta	4	2025-11-01	Almacen	2025-11-01 03:37:28.818529	\N
25	Base  Sensor  De   Tamplow	Enfardado/Ensacado	\N	M32	SB-M-M32	1	Media	1	2025-11-01	Almacen	2025-11-01 03:38:34.727792	\N
26	Sensor  Aplicador Supresor  Fondos	Enfardado/Ensacado	\N	E5	SB-A-E5	1	Alta	2	2025-11-01	Almacen	2025-11-01 03:39:46.43566	\N
27	Sensor Producto	Enfardado/Ensacado	\N	E4	SB-A-E4	6	Alta	3	2025-11-01	Almacen	2025-11-01 03:40:49.924293	\N
28	Eyector	Enfardado/Ensacado	\N	N14	SB-M-N14	3	Media	3	2025-11-01	Almacen	2025-11-01 03:41:37.718613	\N
29	Flauta	Enfardado/Ensacado	\N	M23	SB-A-M23	1	Alta	2	2025-11-01	Almacen	2025-11-01 03:42:27.499066	\N
30	Tamplow	Enfardado/Ensacado	\N	N22	SB-M-N22	2	Media	2	2025-11-01	Almacen	2025-11-01 03:43:22.595098	\N
31	Mts Manguera De 6Mm	Enfardado/Ensacado	\N	N11	SB-A-N11	5	Alta	5	2025-11-01	Almacen	2025-11-01 03:44:37.510642	\N
32	Racor Reguladores  De Velocidad De 1/8 x 6Mm	Enfardado/Ensacado	\N	N5	SB-A-N5	2	Alta	3	2025-11-01	Almacen	2025-11-01 03:46:12.286273	\N
33	Valvula 5/2 1/8 mdo elec r/resort 24v DC	Enfardado/Ensacado	\N	N12	SB-M-N12	2	Alta	3	2025-11-01	Almacen	2025-11-01 03:47:59.285252	\N
35	Racor Codo  De  1/8  x 6Mm	Enfardado/Ensacado	\N	N6	SB/A/N6	8	Alta	8	2025-11-01	Almacen	2025-11-01 03:50:01.948504	\N
36	Varilla En U Eje Enbobinador	Enfardado/Ensacado	\N	M12	SB-A-M12	10	Alta	7	2025-11-01	Almacen	2025-11-01 03:51:29.200431	\N
37	Mts Manguera  De 8mn	Enfardado/Ensacado	\N	N10	SB-A-N10	16	Alta	5	2025-11-01	Almacen	2025-11-01 03:52:55.787102	\N
38	Resorte	Enfardado/Ensacado	\N	M19	SB-A-M19-M	3	Alta	11	2025-11-01	Almacen	2025-11-01 03:53:48.696341	\N
39	Pin Candado	Enfardado/Ensacado	\N	M29	SB-A-M29	9	Alta	9	2025-11-01	Almacen	2025-11-01 03:54:34.308241	\N
40	Fusible   de vidrio 1/2"-1.0A	Enfardado/Ensacado	\N	E18	SB-A-E18	13	Alta	13	2025-11-01	Almacen	2025-11-01 03:56:19.923894	\N
41	Fusible  de vidrio  1/2"  -5.0 A	Enfardado/Ensacado	\N	E22	SB-A-E22	2	Alta	18	2025-11-01	Almacen	2025-11-01 03:57:47.682678	\N
42	Correa Freno	Enfardado/Ensacado	\N	M24	SB-A-M24	12	Alta	12	2025-11-01	Almacen	2025-11-01 03:58:46.093257	\N
43	Fusible de vidrio   -1/2" -5.0 A	Enfardado/Ensacado	\N	E17	SB-A-E17	18	Alta	19	2025-11-01	Almacen	2025-11-01 04:00:31.372999	\N
44	Racor codo de 1/4* 8Mm	Enfardado/Ensacado	\N	N1	SB-A-N1	2	Baja	2	2025-11-01	Almacen	2025-11-01 04:02:15.316933	\N
46	Racor codo de 1/4	Enfardado/Ensacado	\N	N.1	SB-A-N1	5	Baja	4	2025-11-01	Almacen	2025-11-07 21:39:08.39458	\N
34	Oring	Enfardado/Ensacado	\N	M30	SB-A-M30	6	Alta	5	2025-11-01	Almacen	2025-11-07 21:40:17.78351	\N
2	CBL:RF,RPTNC-N  MALE STR,LMR -240,68"	Montacargas-Elevador	\N	CBLRD-1B4000680R	SB-A-C-CBLRD	4	Alta	8	2025-11-01	Almacén	2025-11-24 17:16:37.859717	\N
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
BvW4t4pVxPG67nmsSPIESI5lMlqlYYMW	{"cookie":{"originalMaxAge":86400000,"expires":"2026-01-12T21:16:57.390Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"user":{"id":2,"cedula":"80250899","nombre":"jose raul ruiz","correo":"joseraulruizreal@gmail.com","role":"admin","fecha_registro":"2025-10-31T17:34:16.883Z","estado":"activo"},"userId":2}	2026-01-12 16:17:17
\.


--
-- Data for Name: tablets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tablets (id, ip, ubicacion, no_maquina, activo, serial, estado, fecha_ingreso, observaciones, id_usuario_responsable, fecha_actualizacion, trial186, activo_fijo) FROM stdin;
\.


--
-- Data for Name: tecnicos_horarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tecnicos_horarios (id, nombre, color, activo, fecha_creacion) FROM stdin;
1	José Ruiz	#007bff	t	2025-11-27 18:30:23.570638
2	Juan Vargas	#28a745	t	2025-11-27 18:30:23.570638
3	Richard Prado	#dc3545	t	2025-11-27 18:30:23.570638
4	Adriana B.	#ffc107	t	2025-11-27 18:30:23.570638
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, cedula, nombre, correo, contrasena, fecha_registro, reset_token, reset_token_expires, role, id_usuario_responsable, activo, deleted_at, deleted_by, estado, fecha_expiracion_suspension, fecha_bloqueo) FROM stdin;
13	80250890	juan ruiz	juanvargas@gmail.com	$2b$10$iFp6O/GN1JElgozTz0AnFuiTRs/1tlxUXWvukbSm9qLNVLGm27Fme	2025-11-24 15:42:06.656276	\N	\N	user	\N	t	\N	\N	activo	\N	2025-12-06 06:02:16.978706
15	40511815	miguel ruiz	miguelruiz@gmail.com	$2b$10$6EdY5uIZeRZnNO.lmQh5MOmZ4cUKehKaLJLZQloojh8aVcBuTPl/W	2025-12-06 09:35:53.610043	\N	\N	user	\N	f	\N	\N	bloqueado	\N	\N
2	80250899	jose raul ruiz	joseraulruizreal@gmail.com	$2b$12$Riz9.JNFVFUv0N8x1KVoz.UcvBMPMV4SlNCl1.KbgeSR5qQ971HNa	2025-10-31 12:34:16.883899	\N	\N	admin	\N	t	\N	\N	activo	\N	\N
\.


--
-- Name: access_point_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.access_point_id_seq', 19, true);


--
-- Name: asistencias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencias_id_seq', 43, true);


--
-- Name: etiquetadoras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etiquetadoras_id_seq', 13, true);


--
-- Name: historial_estados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.historial_estados_id_seq', 1, false);


--
-- Name: horarios_calendario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.horarios_calendario_id_seq', 1, true);


--
-- Name: lectores_qr_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lectores_qr_id_seq', 1, false);


--
-- Name: logs_auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.logs_auditoria_id_seq', 4, true);


--
-- Name: mantenimientos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mantenimientos_id_seq', 114, true);


--
-- Name: ordenadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ordenadores_id_seq', 15, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 12, true);


--
-- Name: readers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.readers_id_seq', 17, true);


--
-- Name: repuestos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repuestos_id_seq', 52, true);


--
-- Name: tablets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tablets_id_seq', 1, false);


--
-- Name: tecnicos_horarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tecnicos_horarios_id_seq', 8, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 15, true);


--
-- Name: access_point access_point_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_point
    ADD CONSTRAINT access_point_pkey PRIMARY KEY (id);


--
-- Name: asistencias asistencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_pkey PRIMARY KEY (id);


--
-- Name: etiquetadoras etiquetadoras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetadoras
    ADD CONSTRAINT etiquetadoras_pkey PRIMARY KEY (id);


--
-- Name: historial_estados historial_estados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_estados
    ADD CONSTRAINT historial_estados_pkey PRIMARY KEY (id);


--
-- Name: horarios_calendario horarios_calendario_mes_anio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios_calendario
    ADD CONSTRAINT horarios_calendario_mes_anio_key UNIQUE (mes, anio);


--
-- Name: horarios_calendario horarios_calendario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios_calendario
    ADD CONSTRAINT horarios_calendario_pkey PRIMARY KEY (id);


--
-- Name: lectores_qr lectores_qr_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectores_qr
    ADD CONSTRAINT lectores_qr_pkey PRIMARY KEY (id);


--
-- Name: logs_auditoria logs_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id);


--
-- Name: mantenimientos mantenimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mantenimientos
    ADD CONSTRAINT mantenimientos_pkey PRIMARY KEY (id);


--
-- Name: ordenadores ordenadores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenadores
    ADD CONSTRAINT ordenadores_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: readers readers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.readers
    ADD CONSTRAINT readers_pkey PRIMARY KEY (id);


--
-- Name: repuestos repuestos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_codigo_key UNIQUE (codigo);


--
-- Name: repuestos repuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: tablets tablets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tablets
    ADD CONSTRAINT tablets_pkey PRIMARY KEY (id);


--
-- Name: tecnicos_horarios tecnicos_horarios_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos_horarios
    ADD CONSTRAINT tecnicos_horarios_nombre_key UNIQUE (nombre);


--
-- Name: tecnicos_horarios tecnicos_horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos_horarios
    ADD CONSTRAINT tecnicos_horarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_cedula_key UNIQUE (cedula);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_access_point_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_access_point_estado ON public.access_point USING btree (estado);


--
-- Name: idx_access_point_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_access_point_serial_unique ON public.access_point USING btree (lower(TRIM(BOTH FROM serial))) WHERE ((serial IS NOT NULL) AND (TRIM(BOTH FROM serial) <> ''::text));


--
-- Name: idx_asistencias_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencias_fecha ON public.asistencias USING btree (fecha DESC);


--
-- Name: idx_asistencias_registrante; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencias_registrante ON public.asistencias USING btree (registrante_id);


--
-- Name: idx_asistencias_usuario_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencias_usuario_fecha ON public.asistencias USING btree (usuario_id, fecha DESC);


--
-- Name: idx_etiquetadoras_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etiquetadoras_estado ON public.etiquetadoras USING btree (estado);


--
-- Name: idx_etiquetadoras_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_etiquetadoras_serial_unique ON public.etiquetadoras USING btree (lower(TRIM(BOTH FROM serial))) WHERE ((serial IS NOT NULL) AND (TRIM(BOTH FROM serial) <> ''::text));


--
-- Name: idx_historial_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_fecha ON public.historial_estados USING btree (fecha);


--
-- Name: idx_historial_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_usuario ON public.historial_estados USING btree (usuario_id);


--
-- Name: idx_horarios_fecha_actualizacion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horarios_fecha_actualizacion ON public.horarios_calendario USING btree (fecha_actualizacion);


--
-- Name: idx_horarios_mes_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horarios_mes_anio ON public.horarios_calendario USING btree (mes, anio);


--
-- Name: idx_lectores_qr_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lectores_qr_estado ON public.lectores_qr USING btree (estado);


--
-- Name: idx_logs_auditoria_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_auditoria_fecha ON public.logs_auditoria USING btree (fecha_creacion);


--
-- Name: idx_logs_auditoria_tabla; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_auditoria_tabla ON public.logs_auditoria USING btree (tabla_afectada);


--
-- Name: idx_logs_auditoria_usuario_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_auditoria_usuario_id ON public.logs_auditoria USING btree (usuario_id);


--
-- Name: idx_mantenimientos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mantenimientos_estado ON public.mantenimientos USING btree (estado);


--
-- Name: idx_ordenadores_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ordenadores_estado ON public.ordenadores USING btree (estado);


--
-- Name: idx_ordenadores_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_ordenadores_serial_unique ON public.ordenadores USING btree (lower(TRIM(BOTH FROM serial))) WHERE ((serial IS NOT NULL) AND (TRIM(BOTH FROM serial) <> ''::text));


--
-- Name: idx_password_reset_tokens_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_readers_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_readers_estado ON public.readers USING btree (estado);


--
-- Name: idx_readers_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_readers_serial_unique ON public.readers USING btree (lower(TRIM(BOTH FROM serial))) WHERE ((serial IS NOT NULL) AND (TRIM(BOTH FROM serial) <> ''::text));


--
-- Name: idx_repuestos_cantidad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repuestos_cantidad ON public.repuestos USING btree (cantidad);


--
-- Name: idx_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_expire ON public.session USING btree (expire);


--
-- Name: idx_tablets_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tablets_estado ON public.tablets USING btree (estado);


--
-- Name: idx_tablets_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_tablets_serial_unique ON public.tablets USING btree (lower(TRIM(BOTH FROM serial))) WHERE ((serial IS NOT NULL) AND (TRIM(BOTH FROM serial) <> ''::text));


--
-- Name: idx_tecnicos_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tecnicos_activo ON public.tecnicos_horarios USING btree (activo);


--
-- Name: idx_usuarios_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_activo ON public.usuarios USING btree (activo);


--
-- Name: idx_usuarios_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_estado ON public.usuarios USING btree (estado);


--
-- Name: idx_usuarios_estado_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_estado_activo ON public.usuarios USING btree (estado, activo);


--
-- Name: idx_usuarios_no_eliminados; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_no_eliminados ON public.usuarios USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_usuarios_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_role ON public.usuarios USING btree (role);


--
-- Name: usuarios trigger_limpiar_eliminados; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_limpiar_eliminados BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.debug_limpiar_usuarios_eliminados();


--
-- Name: usuarios trigger_sync_estado; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_sync_estado BEFORE INSERT OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.sync_usuario_estado();


--
-- Name: mantenimientos update_mantenimientos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_mantenimientos_updated_at BEFORE UPDATE ON public.mantenimientos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: access_point access_point_id_usuarios_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_point
    ADD CONSTRAINT access_point_id_usuarios_responsable_fkey FOREIGN KEY (id_usuarios_responsable) REFERENCES public.usuarios(id);


--
-- Name: asistencias asistencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: etiquetadoras etiquetadoras_id_usuarios_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etiquetadoras
    ADD CONSTRAINT etiquetadoras_id_usuarios_responsable_fkey FOREIGN KEY (id_usuarios_responsable) REFERENCES public.usuarios(id);


--
-- Name: asistencias fk_asistencias_registrante; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT fk_asistencias_registrante FOREIGN KEY (registrante_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: usuarios fk_deleted_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: usuarios fk_usuario_responsable; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT fk_usuario_responsable FOREIGN KEY (id_usuario_responsable) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: historial_estados historial_estados_administrador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_estados
    ADD CONSTRAINT historial_estados_administrador_id_fkey FOREIGN KEY (administrador_id) REFERENCES public.usuarios(id);


--
-- Name: historial_estados historial_estados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_estados
    ADD CONSTRAINT historial_estados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: horarios_calendario horarios_calendario_id_usuario_creo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios_calendario
    ADD CONSTRAINT horarios_calendario_id_usuario_creo_fkey FOREIGN KEY (id_usuario_creo) REFERENCES public.usuarios(id);


--
-- Name: lectores_qr lectores_qr_id_usuarios_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectores_qr
    ADD CONSTRAINT lectores_qr_id_usuarios_responsable_fkey FOREIGN KEY (id_usuarios_responsable) REFERENCES public.usuarios(id);


--
-- Name: logs_auditoria logs_auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: mantenimientos mantenimientos_id_usuarios_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mantenimientos
    ADD CONSTRAINT mantenimientos_id_usuarios_fkey FOREIGN KEY (id_usuarios) REFERENCES public.usuarios(id);


--
-- Name: ordenadores ordenadores_id_usuario_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenadores
    ADD CONSTRAINT ordenadores_id_usuario_responsable_fkey FOREIGN KEY (id_usuario_responsable) REFERENCES public.usuarios(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: readers readers_id_usuario_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.readers
    ADD CONSTRAINT readers_id_usuario_responsable_fkey FOREIGN KEY (id_usuario_responsable) REFERENCES public.usuarios(id);


--
-- Name: tablets tablets_id_usuario_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tablets
    ADD CONSTRAINT tablets_id_usuario_responsable_fkey FOREIGN KEY (id_usuario_responsable) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict UddJhvJjoDgdSpTZMRswZzgrCAEzWY17cCtFS5ft5XFX4lutTNM04eoq71L7hZF

