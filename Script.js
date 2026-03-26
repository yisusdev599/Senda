/// --- CONFIGURACIÓN DE MOTOR (PDF.JS) ---
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let modoLectura = 0;
let indicePaginaActual = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar Preferencias
    if (localStorage.getItem('modo-penumbra') === 'activado') {
        document.body.classList.add('dark-mode');
    }

    // 2. Recuperar libro guardado
    const libroGuardado = localStorage.getItem('senda_libro_texto');
    const tituloGuardado = localStorage.getItem('senda_libro_titulo');
    
    if (libroGuardado && tituloGuardado) {
        renderizarLibro(libroGuardado, tituloGuardado);
        
        const posicionGuardada = localStorage.getItem('senda_posicion_scroll');
        if (posicionGuardada) {
            setTimeout(() => {
                window.scrollTo({ top: parseInt(posicionGuardada), behavior: 'smooth' });
                actualizarProgresoScroll(); 
            }, 500);
        }
    }

    // 3. Inicializar Eventos
    configurarEventosMenu();
    configurarBarraFlotante(); 
    window.addEventListener('scroll', actualizarProgresoScroll);
});

function toggleModoPenumbra() {
    // Usamos toggle para la clase
    document.body.classList.toggle('dark-mode');
    
    const activo = document.body.classList.contains('dark-mode');
    localStorage.setItem('modo-penumbra', activo ? 'activado' : 'desactivado');
    
    // Feedback rápido en consola para ver que no hay retraso en la lógica
    console.log("Modo Penumbra:", activo);
}

function toggleModoPenumbra() {
    const esModoOscuro = document.body.classList.toggle('dark-mode');
    localStorage.setItem('modo-penumbra', esModoOscuro ? 'activado' : 'desactivado');

    // TRUCO PARA EL LAG: Forzar un pequeño redibujado
    const cuerpo = document.getElementById('cuerpo-texto');
    if (cuerpo) {
        cuerpo.style.display = 'none';
        cuerpo.offsetHeight; // Esto fuerza al navegador a recalcular
        cuerpo.style.display = 'block';
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        // Entrar en pantalla completa real
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Error al intentar modo pantalla completa: ${err.message}`);
        });
    } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Escuchar el cambio para aplicar estilos de lectura
document.addEventListener('fullscreenchange', () => {
    const body = document.body;
    if (document.fullscreenElement) {
        body.classList.add('zen-mode'); // Clase para el CSS
        console.log("Entró a pantalla completa");
    } else {
        body.classList.remove('zen-mode');
        console.log("Salió de pantalla completa");
        // Recalcular scroll al volver al diseño normal
        window.scrollTo(window.scrollX, window.scrollY); 
        actualizarProgresoScroll();
    }
});

// --- CONFIGURACIÓN DE BOTONES (Puntos de Conexión) ---
function configurarEventosMenu() {
    // Conexión por ID (Basado en tu nuevo HTML)
    const btnNoche = document.getElementById('btn-noche');
    if (btnNoche) btnNoche.onclick = toggleModoPenumbra;

    
}

function configurarBarraFlotante() {
    // Conexión por CLASES (Basado en tu nuevo HTML)
    const btnPrev = document.querySelector('.btn-prev');
    const btnNext = document.querySelector('.btn-next');
    if (btnPrev) btnPrev.onclick = () => navegarPaginas(-1);
    if (btnNext) btnNext.onclick = () => navegarPaginas(1);

    const btnTT = document.querySelector('.btn-tt');
    if (btnTT) btnTT.onclick = cambiarTipografia;

    const btnBookmark = document.querySelector('.btn-bookmark');
    if (btnBookmark) btnBookmark.onclick = marcadorRapido;
}

function cambiarTipografia() {
    const cuerpo = document.getElementById('cuerpo-texto');
    if (!cuerpo) return;
    
    // Quitamos cualquier estilo previo directo para que mande el CSS
    cuerpo.style.fontFamily = "";
    cuerpo.style.fontSize = "";
    cuerpo.style.lineHeight = "";

    modoLectura = (modoLectura + 1) % 3;

    // Removemos clases viejas y ponemos la nueva
    cuerpo.classList.remove('modo-0', 'modo-1', 'modo-2');
    cuerpo.classList.add(`modo-${modoLectura}`);
}
function navegarPaginas(direccion) {
    const saltos = document.querySelectorAll('.page-break');
    if (saltos.length === 0) return;

    indicePaginaActual = Math.max(0, Math.min(indicePaginaActual + direccion, saltos.length - 1));
    saltos[indicePaginaActual].scrollIntoView({ behavior: 'smooth', block: 'start' });

    const labelPagina = document.querySelector('.page-info span');
    if (labelPagina) labelPagina.innerText = `PÁGINA ${indicePaginaActual + 1}`;
}

// --- SISTEMA DE CARGA Y RENDERIZADO ---
async function cargarNuevoPDF(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument(typedarray);
        pdfDoc = await loadingTask.promise;
        
        let textoCompleto = "";
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            
            // Inyectamos el marcador de página para que las flechas funcionen
            textoCompleto += `<span class="page-break" id="pag-${i}"></span>`;
            
            let ultimoY = -1;
            textContent.items.forEach(item => {
                if (ultimoY !== -1 && Math.abs(ultimoY - item.transform[5]) > 10) {
                    textoCompleto += "</p><p>";
                }
                textoCompleto += item.str + " ";
                ultimoY = item.transform[5];
            });
        }

        localStorage.setItem('senda_libro_texto', textoCompleto);
        localStorage.setItem('senda_libro_titulo', archivo.name.replace('.pdf', ''));
        
        // Renderizar y forzar scroll al inicio
        renderizarLibro(textoCompleto, archivo.name);
        window.scrollTo(0, 0);
        actualizarProgresoScroll();
    };
    reader.readAsArrayBuffer(archivo);
}

function renderizarLibro(texto, titulo) {
    const visorContainer = document.getElementById('visor-pdf-container');
    if (visorContainer) {
        visorContainer.innerHTML = `
            <div class="text-canvas">
                <p class="book-subtitle">Senda | Lectura Activa</p>
                <h1 class="book-title">${titulo}</h1>
                <div class="real-text-body" id="cuerpo-texto"><p>${texto}</p></div>
            </div>
        `;
    }
    // Ocultar instrucciones si existen
    const inst = document.getElementById('instrucciones-iniciales');
    if (inst) inst.style.display = 'none';
}

function actualizarProgresoScroll() {
    const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
    const posicionActual = window.scrollY;
    const porcentaje = scrollTotal > 0 ? Math.round((posicionActual / scrollTotal) * 100) : 0;
    
    // --- NUEVO: DETECTAR PÁGINA MIENTRAS HACES SCROLL ---
    const saltos = document.querySelectorAll('.page-break');
    let paginaDetectada = 1;

    saltos.forEach((salto, index) => {
        const rect = salto.getBoundingClientRect();
        // Si la marca de página ya pasó la mitad de la pantalla o está cerca del tope
        if (rect.top < window.innerHeight / 3) {
            paginaDetectada = index + 1;
            indicePaginaActual = index; // Sincronizamos el índice para las flechas
        }
    });

    // Actualizar el texto de la barra flotante
    const labelPagina = document.querySelector('.page-info span');
    if (labelPagina && saltos.length > 0) {
        labelPagina.innerText = `PÁGINA ${paginaDetectada}`;
    }
    // ---------------------------------------------------

    // Actualizar barras de progreso (lo que ya tenías)
    const sidebarFill = document.querySelector('.progress-fill');
    const pctLabel = document.querySelector('.pct');
    const statsText = document.querySelector('.stats');

    if (sidebarFill) sidebarFill.style.width = `${porcentaje}%`;
    if (pctLabel) pctLabel.innerText = `${porcentaje}%`;
    if (statsText) statsText.innerText = `${porcentaje}% COMPLETADO`;

    // Auto-guardado
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
        localStorage.setItem('senda_posicion_scroll', Math.round(posicionActual));
    }, 1000);
}

function marcadorRapido() {
    localStorage.setItem('senda_posicion_scroll', window.scrollY);
    const btn = document.querySelector('.btn-bookmark');
    if (btn) {
        btn.style.color = "#d4af37";
        setTimeout(() => btn.style.color = "", 1000);
    }
}

function cerrarLibroActual() {
    if (confirm("¿Estás seguro de que quieres quitar el libro actual?")) {
        localStorage.removeItem('senda_libro_texto');
        localStorage.removeItem('senda_libro_titulo');
        localStorage.removeItem('senda_posicion_scroll');
        window.location.reload();
    }
}

// Añadir al DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Recuperar estado guardado
    if (localStorage.getItem('descanso-visual') === 'activado') {
        document.body.classList.add('descanso-activo');
    }
    
    // Vincular al botón del menú
    const btnCalido = document.getElementById('btn-calido');
    if (btnCalido) btnCalido.onclick = toggleDescansoVisual;
});

function toggleDescansoVisual() {
    // Simplemente activamos/desactivamos la clase
    const activo = document.body.classList.toggle('modo-descanso');
    localStorage.setItem('senda-descanso', activo ? 'si' : 'no');
}

// Asegúrate de que en tu DOMContentLoaded esté esto:
if (localStorage.getItem('senda-descanso') === 'si') {
    document.body.classList.add('modo-descanso');
}

