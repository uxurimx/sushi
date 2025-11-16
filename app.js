document.addEventListener('DOMContentLoaded', async () => {

    // Cargar datos desde db.json (preparado para futura API)
    let DB = null;
    try {
        const res = await fetch('./db.json');
        if (res.ok) DB = await res.json();
        else console.warn('db.json no disponible, status:', res.status);
    } catch (e) {
        console.error('Error cargando db.json:', e);
    }

    // --- LÓGICA DE MODO OSCURO ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const themeColorMeta = document.getElementById('theme-color-meta');

    // Función para actualizar el tema
    const updateTheme = (isDark) => {
        // Define tus colores de barra
        const darkColor = "#171717";  // Tu nuevo color de fondo (Neutral 900)
        const lightColor = "#FFFFFF"; // Tu color de fondo claro

        if (isDark) {
            document.documentElement.classList.add('dark');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            localStorage.setItem('theme', 'dark');
            // Actualiza el color de la barra
            themeColorMeta.setAttribute('content', darkColor); 
        } else {
            document.documentElement.classList.remove('dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            localStorage.setItem('theme', 'light');
            // Actualiza el color de la barra
            themeColorMeta.setAttribute('content', lightColor);
        }
    
    };

    // Listener para el botón
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        updateTheme(!isDark);
    });

    // Cargar tema al iniciar
    const loadTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            updateTheme(true);
        } else {
            updateTheme(false);
        }
    };
    loadTheme();

    // Generar menús dinámicamente desde DB (si existe)
    if (DB && Array.isArray(DB.menus)) {
        const menusNav = document.getElementById('menus-nav');
        const mainEl = document.querySelector('main');
        if (menusNav && mainEl) {
            DB.menus.forEach((m, idx) => {
                // Crear botón
                const btn = document.createElement('button');
                btn.className = 'tap-press tab-button flex-none py-3 px-4 min-w-[96px] text-center font-semibold border-b-4 transition-all duration-300';
                btn.dataset.tab = m.id;
                btn.textContent = m.label || m.id;
                // Estilos del primer botón (activo)
                if (idx === 0) {
                    btn.classList.add('border-brand-primary', 'text-brand-primary');
                } else {
                    btn.classList.add('border-transparent', 'text-gray-400', 'dark:text-gray-500');
                }
                // Insert buttons between the left/right indicators (if present)
                const rightIndicator = menusNav.querySelector('#menus-scroll-right');
                if (rightIndicator) menusNav.insertBefore(btn, rightIndicator);
                else menusNav.appendChild(btn);

                // Asegurar que existe un panel con id `${m.id}-panel`
                const panelId = `${m.id}-panel`;
                if (!document.getElementById(panelId)) {
                    const panel = document.createElement('div');
                    panel.id = panelId;
                    panel.className = 'tab-panel p-4 space-y-4 hidden';
                    mainEl.appendChild(panel);
                }
            });
        }
    }

    // =============================================
    // ==== 1. LÓGICA PWA: REGISTRAR SERVICE WORKER ====
    // =============================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('./sw.js')
                // .then(reg => console.log('Service Worker: Registrado'))
                .catch(err => console.error(`Service Worker: Error: ${err}`));
        });
    }

    // =============================================
    // ==== 2. LÓGICA PWA: PROMPT DE INSTALACIÓN ====
    // =============================================
    let deferredPrompt; // Variable para guardar el evento
    const installButton = document.getElementById('install-pwa-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Previene que el navegador muestre su mini-infobar
        e.preventDefault();
        // Guarda el evento para que podamos dispararlo luego
        deferredPrompt = e;
        // Muestra nuestro botón de instalación personalizado
        installButton.classList.remove('hidden');
        // console.log('Evento beforeinstallprompt capturado.');
    });

    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return; // Si no hay evento, no hacer nada
        }
        // Oculta nuestro botón
        installButton.classList.add('hidden');
        
        // Muestra el diálogo de instalación nativo
        deferredPrompt.prompt();
        
        // Espera a que el usuario elija (aceptar o rechazar)
        const { outcome } = await deferredPrompt.userChoice;
        // console.log(`Resultado del usuario: ${outcome}`);
        
        // Limpiamos la variable, solo se puede usar una vez
        deferredPrompt = null;
    });

    const CART_STORAGE_KEY = 'kaizenSushiCart';

    function loadCartFromStorage() {
        try {
            const storedCart = localStorage.getItem(CART_STORAGE_KEY);
            if (storedCart) {
                return JSON.parse(storedCart);
            }
        } catch (e) {
            console.error('Error al cargar el carrito de localStorage', e);
        }
        return []; 
    }

    // --- ESTADO DE LA APLICACIÓN --- (Línea ~316)
    const appState = {
        currentTab: 'builder',
        customRoll: {
            base: null,
            protein: [],
            filling: [],
            topping: null
        },
        cart: loadCartFromStorage(), // <-- AHORA SÍ FUNCIONA
    };

    // Número de WhatsApp del restaurante (será provisto por db.json si está disponible)
    let RESTAURANT_PHONE = '';
    if (DB && DB.restaurantPhone) {
        RESTAURANT_PHONE = DB.restaurantPhone;
    }

    // Si tenemos datos, poblar las secciones dinámicas (builder, gallery, drinks)
    if (DB) {
        const makeBuilderOption = (item, step) => {
            // Conservamos la estructura esperada por la lógica (atributos data-...)
            return `
            <div class="builder-option" data-step="${step}" data-name="${escapeHtml(item.name)}" data-price="${Number(item.price).toFixed(2)}" ${step === 'protein' || step === 'filling' ? 'data-multi="true"' : ''}>
                <div class="tap-press p-4 border dark:border-dark-border rounded-lg text-center shadow-sm cursor-pointer hover:shadow-md dark:bg-dark-card dark:hover:bg-dark-border transition-all">
                    <p class="font-semibold mt-2 dark:text-white">${escapeHtml(item.name)}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">$${Number(item.price).toFixed(2)}</p>
                </div>
            </div>`;
        };

        const baseContainer = document.getElementById('builder-base-container');
        const proteinContainer = document.getElementById('builder-protein-container');
        const fillingContainer = document.getElementById('builder-filling-container');
        const toppingContainer = document.getElementById('builder-topping-container');

        if (baseContainer && DB.builder && DB.builder.base) {
            baseContainer.innerHTML = DB.builder.base.map(i => makeBuilderOption(i, 'base')).join('');
        }
        if (proteinContainer && DB.builder && DB.builder.protein) {
            proteinContainer.innerHTML = DB.builder.protein.map(i => makeBuilderOption(i, 'protein')).join('');
        }
        if (fillingContainer && DB.builder && DB.builder.filling) {
            fillingContainer.innerHTML = DB.builder.filling.map(i => makeBuilderOption(i, 'filling')).join('');
        }
        if (toppingContainer && DB.builder && DB.builder.topping) {
            toppingContainer.innerHTML = DB.builder.topping.map(i => makeBuilderOption(i, 'topping')).join('');
        }

        // Gallery
        const galleryList = document.getElementById('gallery-list');
        if (galleryList && DB.gallery) {
            galleryList.innerHTML = DB.gallery.map(it => `
                <div class="gallery-item-container tap-press relative cursor-pointer flex items-center space-x-4 bg-brand-white dark:bg-dark-card p-3 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-dark-border"
                     data-id="${escapeHtml(it.id)}"
                     data-name="${escapeHtml(it.name)}"
                     data-price="${Number(it.price).toFixed(2)}"
                     data-description="${escapeHtml(it.description)}"
                     data-image-src="${escapeHtml(it.imageSrc)}">
                    <img src="${escapeHtml(it.imageSrc)}" alt="${escapeHtml(it.name)}" class="w-20 h-20 rounded-md object-cover flex-shrink-0">
                    <span class="item-badge absolute top-2 right-2 bg-brand-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg dark:text-white">${escapeHtml(it.name)}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(it.description)}</p>
                        <p class="font-bold text-gray-900 dark:text-gray-100 mt-1">$${Number(it.price).toFixed(2)}</p>
                    </div>
                    <button class="add-gallery-btn tap-press p-3 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary/80 rounded-full transform transition-transform hover:scale-110" data-id="${escapeHtml(it.id)}" data-name="${escapeHtml(it.name)}" data-price="${Number(it.price).toFixed(2)}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </button>
                </div>
            `).join('');
        }

        // Drinks (render as gallery-item-container so they show image + detail modal)
        const drinksList = document.getElementById('drinks-list');
        if (drinksList && DB.drinks) {
            drinksList.innerHTML = DB.drinks.map(d => `
                <div class="gallery-item-container tap-press relative cursor-pointer flex items-center space-x-4 bg-brand-white dark:bg-dark-card p-3 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-dark-border"
                     data-id="${escapeHtml(d.id)}"
                     data-name="${escapeHtml(d.name)}"
                     data-price="${Number(d.price).toFixed(2)}"
                     data-description="${escapeHtml(d.description || '')}"
                     data-image-src="${escapeHtml(d.imageSrc || './img/default_drink.png')}">
                    <img src="${escapeHtml(d.imageSrc || './img/default_drink.png')}" alt="${escapeHtml(d.name)}" class="w-20 h-20 rounded-md object-cover flex-shrink-0">
                    <span class="item-badge absolute top-2 right-2 bg-brand-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg dark:text-white">${escapeHtml(d.name)}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(d.description || '')}</p>
                        <p class="font-bold text-gray-900 dark:text-gray-100 mt-1">$${Number(d.price).toFixed(2)}</p>
                    </div>
                    <button class="add-gallery-btn tap-press p-3 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary/80 rounded-full transform transition-transform hover:scale-110" data-id="${escapeHtml(d.id)}" data-name="${escapeHtml(d.name)}" data-price="${Number(d.price).toFixed(2)}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </button>
                </div>
            `).join('');
        }
    }

    // Render any additional menus defined in DB.menus (e.g., desserts)
    function renderExtraMenus() {
        if (DB && Array.isArray(DB.menus)) {
            DB.menus.forEach(m => {
                if (['builder','gallery','drinks'].includes(m.id)) return; // already handled elsewhere
                const panel = document.getElementById(`${m.id}-panel`);
                const items = DB[m.id];
                if (panel && Array.isArray(items)) {
                    let list = panel.querySelector(`#${m.id}-list`);
                    if (!list) {
                        list = document.createElement('div');
                        list.id = `${m.id}-list`;
                        list.className = 'space-y-3';
                        panel.appendChild(list);
                    }

                    list.innerHTML = items.map(it => `
                        <div class="gallery-item-container tap-press relative cursor-pointer flex items-center space-x-4 bg-brand-white dark:bg-dark-card p-3 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-dark-border"
                             data-id="${escapeHtml(it.id)}"
                             data-name="${escapeHtml(it.name)}"
                             data-price="${Number(it.price).toFixed(2)}"
                             data-description="${escapeHtml(it.description || '')}"
                             data-image-src="${escapeHtml(it.imageSrc || './img/default.png')}">
                            <img src="${escapeHtml(it.imageSrc || './img/default.png')}" alt="${escapeHtml(it.name)}" class="w-20 h-20 rounded-md object-cover flex-shrink-0">
                            <span class="item-badge absolute top-2 right-2 bg-brand-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
                            <div class="flex-grow">
                                <h3 class="font-bold text-lg dark:text-white">${escapeHtml(it.name)}</h3>
                                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(it.description || '')}</p>
                                <p class="font-bold text-gray-900 dark:text-gray-100 mt-1">$${Number(it.price).toFixed(2)}</p>
                            </div>
                            <button class="add-gallery-btn tap-press p-3 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary/80 rounded-full transform transition-transform hover:scale-110" data-id="${escapeHtml(it.id)}" data-name="${escapeHtml(it.name)}" data-price="${Number(it.price).toFixed(2)}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            </button>
                        </div>
                    `).join('');
                }
            });
        }
    }

    // Populate extra menus now that panels exist and base sections were rendered
    renderExtraMenus();

    // Small helper to avoid XSS when injecting strings into templates
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Último pedido confirmado (se usa para abrir WhatsApp después de confirmar)
    let lastOrder = null;

    // --- SELECTORES DE ELEMENTOS ---
    const heroScreen = document.getElementById('hero-screen');
    const appScreen = document.getElementById('app-screen');
    const startButton = document.getElementById('start-button');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const builderFooter = document.getElementById('builder-footer');
    const summaryPrice = document.getElementById('builder-summary-price');
    const summaryItems = document.getElementById('builder-summary-items');
    const addCustomRollBtn = document.getElementById('add-custom-roll-btn');
    const toasterMessage = document.getElementById('toaster-message');
    
    // Carrito - CÓDIGO CORREGIDO Y COMPLETADO
    const cartButton = document.getElementById('cart-button');
    const cartModal = document.getElementById('cart-modal');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartItemsList = document.getElementById('cart-items-list');
    const clearCartBtn = document.getElementById('clear-cart-btn'); // <-- AÑADE ESTE
    const cartCount = document.getElementById('cart-count');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const placeOrderBtn = document.getElementById('place-order-btn');

    // --- Selectores del Modal de Confirmación (NUEVO) ---
    const confirmModal = document.getElementById('confirm-modal');
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    
    // Modal de Éxito - CÓDIGO CORREGIDO Y COMPLETADO
    const successModal = document.getElementById('success-modal');
    const successOverlay = document.getElementById('success-overlay'); // Añadido
    const closeSuccessBtn = document.getElementById('close-success-btn');
    const cancelSuccessBtn = document.getElementById('cancel-success-btn'); // <-- AÑADE ESTE

    // Modal de Detalle
    const detailModal = document.getElementById('detail-modal');
    const detailOverlay = document.getElementById('detail-overlay');
    const closeDetailBtn = document.getElementById('close-detail-btn');
    const detailModalImage = document.getElementById('detail-modal-image');
    const detailModalName = document.getElementById('detail-modal-name');
    const detailModalDescription = document.getElementById('detail-modal-description');
    const detailModalPrice = document.getElementById('detail-modal-price');
    const detailModalAddBtn = document.getElementById('detail-modal-add-btn');

    // Toaster - CÓDIGO CORREGIDO Y COMPLETADO
    const toaster = document.getElementById('toaster');
    // const toasterMessage = document.getElementById('toaster-message');

    // --- LÓGICA DE NAVEGACIÓN Y PANTALLAS ---

    // Empezar la app
    startButton.addEventListener('click', () => {
        document.documentElement.classList.add('app-cargada');
    });

    // Cambiar pestañas
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            appState.currentTab = tab;
            
            // Actualizar UI de pestañas
            tabButtons.forEach(btn => {
                if (btn.dataset.tab === tab) {
                    btn.classList.add('border-brand-primary', 'text-brand-primary');
                    btn.classList.remove('border-transparent', 'text-gray-400', 'dark:text-gray-500');
                } else {
                    btn.classList.remove('border-brand-primary', 'text-brand-primary');
                    btn.classList.add('border-transparent', 'text-gray-400', 'dark:text-gray-500');
                }
            });

            // Mostrar/Ocultar Paneles
            tabPanels.forEach(panel => {
                if (panel.id === `${tab}-panel`) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });

            // Mostrar/Ocultar Footer del Taller
            if (tab === 'builder') {
                builderFooter.classList.remove('hidden');
            } else {
                builderFooter.classList.add('hidden');
            }
        });
    });

    // Re-consultar elementos dinámicos que pueden haberse generado desde db.json
    const builderOptions = document.querySelectorAll('.builder-option');
    const galleryAddButtons = document.querySelectorAll('.add-gallery-btn');
    const galleryItemContainers = document.querySelectorAll('.gallery-item-container');

    // --- LÓGICA DEL "TALLER" (ARMA TU ROLLO) ---
    builderOptions.forEach(option => {
        option.addEventListener('click', () => {
            const step = option.dataset.step;
            const name = option.dataset.name;
            const price = parseFloat(option.dataset.price);
            const isMulti = option.dataset.multi === 'true';

            const item = { name, price };

            if (isMulti) {
                // Lógica multi-selección (Proteína, Relleno)
                const list = appState.customRoll[step];
                const index = list.findIndex(i => i.name === name);
                
                if (index > -1) {
                    list.splice(index, 1); // Quitar
                    option.querySelector('div').classList.remove('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
                } else {
                    list.push(item); // Añadir
                    option.querySelector('div').classList.add('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
                }
            } else {
                // Lógica de selección única (Base, Topping)
                if (appState.customRoll[step] && appState.customRoll[step].name === name) {
                    // Des-seleccionar
                    appState.customRoll[step] = null;
                    option.querySelector('div').classList.remove('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
                } else {
                    // Quitar selección previa
                    document.querySelectorAll(`[data-step="${step}"]`).forEach(el => {
                        el.querySelector('div').classList.remove('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
                    });
                    // Seleccionar nuevo
                    appState.customRoll[step] = item;
                    option.querySelector('div').classList.add('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
                }
            }
            
            updateBuilderSummary();
        });
    });

    function updateBuilderSummary() {
        let total = 0;
        let items = [];
        
        if (appState.customRoll.base) {
            total += appState.customRoll.base.price;
            items.push(appState.customRoll.base.name);
        }
        appState.customRoll.protein.forEach(item => {
            total += item.price;
            items.push(item.name);
        });
        appState.customRoll.filling.forEach(item => {
            total += item.price;
            items.push(item.name);
        });
        if (appState.customRoll.topping) {
            total += appState.customRoll.topping.price;
            items.push(appState.customRoll.topping.name);
        }

        summaryPrice.textContent = `$${total.toFixed(2)}`;
        
        if (items.length > 0) {
            summaryItems.textContent = items.join(' + ');
        } else {
            summaryItems.textContent = 'Base + Proteína + Relleno...';
        }

        // Habilitar botón si hay al menos una base
        if (appState.customRoll.base) {
            addCustomRollBtn.disabled = false;
        } else {
            addCustomRollBtn.disabled = true;
        }
    }

    // Añadir Rollo Personalizado al Carrito
    addCustomRollBtn.addEventListener('click', () => {
        if (!appState.customRoll.base) return; // No se puede añadir sin base

        let total = 0;
        let items = [];
        
        if (appState.customRoll.base) {
            total += appState.customRoll.base.price;
            items.push(appState.customRoll.base.name);
        }
        appState.customRoll.protein.forEach(item => { total += item.price; items.push(item.name); });
        appState.customRoll.filling.forEach(item => { total += item.price; items.push(item.name); });
        if (appState.customRoll.topping) {
            total += appState.customRoll.topping.price;
            items.push(appState.customRoll.topping.name);
        }

        // const rollName = `Rollo Taller (${items.join(', ')})`; // <-- LÍNEA ANTIGUA
        const rollName = "Tu rollo personalizado"; // <-- LÍNEA NUEVA
        
        const cartItem = {
            id: `custom-${new Date().getTime()}`,
            name: rollName,
            price: total,
            quantity: 1,
            isCustom: true,
            description: items.join(' + '),
            notes: ''
        };

        addItemToCart(cartItem);
        
        // Resetear Taller
        appState.customRoll = { base: null, protein: [], filling: [], topping: null };
        document.querySelectorAll('.builder-option').forEach(el => {
            el.querySelector('div').classList.remove('border-brand-primary', 'ring-2', 'ring-brand-primary', 'dark:border-brand-primary');
        });
        updateBuilderSummary();
    });

    // Añadir Item de Galería al Carrito (Botón +)
    galleryAddButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // IMPORTANTE: Evita que se abra el modal de detalle
            
            const cartItem = {
                id: button.dataset.id,
                name: button.dataset.name,
                price: parseFloat(button.dataset.price),
                quantity: 1,
                notes: ''
            };
            addItemToCart(cartItem);
        });
    });

    // --- LÓGICA DEL MODAL DE DETALLES ---

    function openDetailModal(data) {
        // Poblar el modal
        detailModalImage.src = data.imageSrc;
        detailModalImage.alt = data.name;
        detailModalName.textContent = data.name;
        detailModalDescription.textContent = data.description;
        detailModalPrice.textContent = `$${parseFloat(data.price).toFixed(2)}`;
        
        // Guardar los datos en el botón de añadir del modal
        detailModalAddBtn.dataset.id = data.id;
        detailModalAddBtn.dataset.name = data.name;
        detailModalAddBtn.dataset.price = data.price;
        
        // Mostrar el modal
        detailModal.style.display = 'block';
    }

    function closeDetailModal() {
        detailModal.style.display = 'none';
    }

    // Abrir modal al hacer clic en un item de la galería
    galleryItemContainers.forEach(item => {
        item.addEventListener('click', () => {
            openDetailModal({
                id: item.dataset.id,
                name: item.dataset.name,
                price: item.dataset.price,
                description: item.dataset.description,
                imageSrc: item.dataset.imageSrc
            });
        });
    });

    // Cerrar modal
    closeDetailBtn.addEventListener('click', closeDetailModal);
    detailOverlay.addEventListener('click', closeDetailModal);

    // Abrir/Cerrar modal del carrito (añadido: arregla que el botón no abra el modal)
    cartButton.addEventListener('click', () => {
        cartModal.style.display = 'block';
    });
    closeCartBtn.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });
    cartOverlay.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });
    clearCartBtn.addEventListener('click', () => {
        // Solo muestra el modal de confirmación
        confirmModal.style.display = 'block';
    });

    const closeConfirmModal = () => {
        confirmModal.style.display = 'none';
    };

    // Botón "Sí, vaciar carrito"
    confirmClearBtn.addEventListener('click', () => {
        // Aquí va la lógica que estaba en el confirm()
        appState.cart = [];
        updateCart(); // Esto actualiza la UI y el localStorage
        closeConfirmModal(); // Cierra este modal
    });

    // Botón "Cancelar"
    cancelClearBtn.addEventListener('click', closeConfirmModal);

    // Clic en el fondo (overlay)
    confirmOverlay.addEventListener('click', closeConfirmModal);
    
    // Botón "Añadir" dentro del modal de detalle
    detailModalAddBtn.addEventListener('click', () => {
        const cartItem = {
            id: detailModalAddBtn.dataset.id,
            name: detailModalAddBtn.dataset.name,
            price: parseFloat(detailModalAddBtn.dataset.price),
            quantity: 1,
            notes: ''
        };
        addItemToCart(cartItem);
        closeDetailModal();
    });

    // --- LÓGICA DEL CARRITO ---

    function addItemToCart(item) {
        // Verificar si ya existe
        const existingItem = appState.cart.find(cartItem => cartItem.id === item.id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            appState.cart.push(item);
        }
        
        // Vibración corta si está disponible (mejora UX en móviles)
        if (navigator.vibrate) {
            try { navigator.vibrate(50); } catch (e) { /* safe */ }
        }

        showToaster(item.isCustom ? "¡Rollo creado y añadido!" : "¡Añadido al pedido!");
        updateCart();
    }

    function updateCart() {
        // Actualizar contador
        const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);

        // Mostrar/ocultar badge del header según total
        if (totalItems > 0) {
            cartCount.textContent = totalItems;
            cartCount.classList.remove('hidden');
        } else {
            cartCount.classList.add('hidden');
        }

        // Actualizar lista de items
        if (appState.cart.length === 0) {
            cartItemsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-10">Tu carrito está vacío.</p>';
        } else {
            cartItemsList.innerHTML = appState.cart.map(item => `
                <div class="flex items-start space-x-4 bg-brand-white dark:bg-dark-card p-3 rounded-lg">
                    <div class="flex-grow">
                        <p class="font-bold dark:text-white">${item.name}</p>
                        ${item.isCustom ? `<p class="text-xs text-gray-500 dark:text-gray-400">${item.description}</p>` : ''}
                        <p class="font-semibold text-gray-900 dark:text-gray-100 mt-1 mb-2">$${item.price.toFixed(2)}</p>
                        
                        <input 
                            type="text" 
                            class="cart-item-notes-input w-full text-sm bg-gray-100 dark:bg-dark-bg dark:text-white p-2 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none" 
                            placeholder="Notas (ej. sin cebolla)" 
                            value="${item.notes || ''}" 
                            data-id="${item.id}">
                        
                    </div>
                    <div class="flex items-center space-x-3">
                        <button class="cart-quantity-btn tap-press" data-id="${item.id}" data-action="decrease">
                            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                        </button>
                        <span class="font-bold w-5 text-center dark:text-white">${item.quantity}</span>
                        <button class="cart-quantity-btn tap-press" data-id="${item.id}" data-action="increase">
                            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </button>
                    </div>
                    <button class="cart-remove-btn tap-press p-1" data-id="${item.id}">
                        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `).join('');
        }

        // Actualizar total
        const totalPrice = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotalPrice.textContent = `$${totalPrice.toFixed(2)}`;

        // Habilitar botón de confirmar pedido
        const isCartEmpty = appState.cart.length === 0;
        placeOrderBtn.disabled = isCartEmpty;
        
        if (isCartEmpty) {
            clearCartBtn.classList.add('hidden');
        } else {
            clearCartBtn.classList.remove('hidden');
        }

        // --- Actualizar badges en menú y bebidas ---
        const counts = {};
        appState.cart.forEach(it => { counts[it.id] = (counts[it.id] || 0) + it.quantity; });

        document.querySelectorAll('.gallery-item-container, .drink-item').forEach(container => {
            const id = container.dataset.id;
            const badge = container.querySelector('.item-badge');
            if (!badge) return;
            const c = counts[id] || 0;
            if (c > 0) {
                badge.textContent = c;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(appState.cart));
    }

    // Manejo de botones dentro del carrito (aumentar / disminuir / eliminar)
    cartItemsList.addEventListener('click', (e) => {
        const quantityBtn = e.target.closest('.cart-quantity-btn');
        const removeBtn = e.target.closest('.cart-remove-btn');

        if (quantityBtn) {
            const id = quantityBtn.dataset.id;
            const action = quantityBtn.dataset.action;
            const item = appState.cart.find(i => i.id === id);
            if (!item) return;

            if (action === 'increase') {
                item.quantity += 1;
            } else if (action === 'decrease') {
                item.quantity -= 1;
                if (item.quantity <= 0) {
                    appState.cart = appState.cart.filter(i => i.id !== id);
                }
            }
            updateCart();
            return;
        }

        if (removeBtn) {
            const id = removeBtn.dataset.id;
            appState.cart = appState.cart.filter(i => i.id !== id);
            updateCart();
        }
    });

    cartItemsList.addEventListener('input', (e) => {
        const notesInput = e.target.closest('.cart-item-notes-input');
        
        if (notesInput) {
            const id = notesInput.dataset.id;
            const item = appState.cart.find(i => i.id === id);
            
            if (item) {
                // 1. Actualiza el estado de la app
                item.notes = notesInput.value;
                
                // 2. Persiste en localStorage INMEDIATAMENTE
                // (No llamamos a updateCart() para evitar que el input pierda el foco)
                localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(appState.cart));
            }
        }
        // Setup scroll indicators for menus nav (if present)
        const menusNavEl = document.getElementById('menus-nav');
        const scrollLeftBtn = document.getElementById('menus-scroll-left');
        const scrollRightBtn = document.getElementById('menus-scroll-right');
        if (menusNavEl && scrollLeftBtn && scrollRightBtn) {
            // Toggle indicators based on overflow
            const checkOverflow = () => {
                const need = menusNavEl.scrollWidth > menusNavEl.clientWidth + 4;
                if (!need) {
                    scrollLeftBtn.classList.add('hidden');
                    scrollRightBtn.classList.add('hidden');
                    return;
                }
                // Show/hide left based on scrollLeft
                if (menusNavEl.scrollLeft > 8) scrollLeftBtn.classList.remove('hidden'); else scrollLeftBtn.classList.add('hidden');
                // Show/hide right based on remaining scroll
                if (menusNavEl.scrollLeft + menusNavEl.clientWidth < menusNavEl.scrollWidth - 8) scrollRightBtn.classList.remove('hidden'); else scrollRightBtn.classList.add('hidden');
            };

            // Scroll by a chunk when clicking indicators
            scrollLeftBtn.addEventListener('click', () => { menusNavEl.scrollBy({ left: -120, behavior: 'smooth' }); });
            scrollRightBtn.addEventListener('click', () => { menusNavEl.scrollBy({ left: 120, behavior: 'smooth' }); });

            menusNavEl.addEventListener('scroll', checkOverflow);
            window.addEventListener('resize', checkOverflow);
            // Initial check (small timeout to allow DOM paint)
            setTimeout(checkOverflow, 50);
        }
    });

    // Confirmar pedido: cerrar carrito, mostrar modal de éxito y guardar snapshot del pedido
    placeOrderBtn.addEventListener('click', () => {
        // En una app real aquí se enviaría al servidor
        console.log('Pedido Confirmado:', appState.cart);

        // Crear snapshot del pedido para enviarlo por WhatsApp
        const totalPrice = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        lastOrder = {
            id: `ORD-${new Date().getTime()}`,
            items: appState.cart.map(i => ({ 
                id: i.id, 
                name: i.name, 
                price: i.price, 
                quantity: i.quantity, 
                isCustom: !!i.isCustom, 
                description: i.description || '',
                notes: i.notes || '' 
            })),
            total: totalPrice
        };

        // Cerrar modal de carrito y abrir modal de éxito
        cartModal.style.display = 'none';
        successModal.style.display = 'block';
    });

    // Cerrar modal de éxito
    const closeSuccessModal = () => { successModal.style.display = 'none'; };

    // Formatea el pedido para enviar por WhatsApp
    function formatOrderMessage(order) {
        if (!order || !order.items || order.items.length === 0) {
            return 'KAIZEN Sushi - Pedido vacío';
        }

        const lines = [];
        lines.push(`KAIZEN Sushi - Pedido ${order.id}`);
        lines.push('');

        order.items.forEach(item => {
            const qty = item.quantity || 1;
            const unit = Number(item.price).toFixed(2);
            const total = (item.price * qty).toFixed(2);
            let l = `${qty} x ${item.name} — $${total} ( $${unit} c/u )`;
            if (item.isCustom && item.description) {
                l += `\n    • ${item.description}`;
            }
            if (item.notes) {
                l += `\n    • NOTA: ${item.notes}`;
            }
            lines.push(l);
        });

        lines.push('');
        lines.push(`Total: $${Number(order.total).toFixed(2)}`);
        lines.push('');
        lines.push('Por favor confirmar. Gracias!');

        return lines.join('\n');
    }

    // Abrir WhatsApp con el pedido formateado (usa RESTAURANT_PHONE)
    function openWhatsAppForLastOrder() {
        const msg = formatOrderMessage(lastOrder);
        const phone = (RESTAURANT_PHONE || '').toString().replace(/\D/g, '');
        if (!phone) {
            alert('Número de restaurante no configurado.');
            return;
        }
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    closeSuccessBtn.addEventListener('click', () => {
        openWhatsAppForLastOrder();
        appState.cart = [];
        updateCart(); 
        closeSuccessModal();
    });

    cancelSuccessBtn.addEventListener('click', () => {
        // Solo cierra el modal. El carrito sigue lleno.
        closeSuccessModal();
    });
    
    // --- LÓGICA DEL TOASTER ---
    let toasterTimeout;
    function showToaster(message) {
        toasterMessage.textContent = message;
        toaster.classList.remove('opacity-0', '-translate-y-3');
        toaster.classList.add('opacity-100', 'translate-y-0');

        clearTimeout(toasterTimeout);
        // Mostrar más rápido y ocultar antes
        toasterTimeout = setTimeout(() => {
            toaster.classList.add('opacity-0', '-translate-y-3');
            toaster.classList.remove('opacity-100', 'translate-y-0');
        }, 1200);
    }
    updateCart();

}); // Fin de DOMContentLoaded