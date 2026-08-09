// 1. Declare the variable at the top
let authModal;

document.addEventListener('DOMContentLoaded', () => {
    // 2. Initialize it as soon as the DOM is ready
    const modalElement = document.getElementById('authModal');
    if (modalElement) {
        authModal = new bootstrap.Modal(modalElement);
    }
});

// 3. Now the function can safely access it
function openAuthModal(mode) {
    if (mode === 'login') {
        toggleAuthForms('login');
    } else {
        toggleAuthForms('register');
    }
    
    if (authModal) {
        authModal.show();
    } else {
        // Fallback: Initialize if not already done
        authModal = new bootstrap.Modal(document.getElementById('authModal'));
        authModal.show();
    }
}
        // ==========================
        // 🧠 LOGIC CONTROLLER
        // ==========================

        // 🌍 GLOBAL VARIABLES
        let currentUser = JSON.parse(localStorage.getItem('carpoolUser'));
        let mapInstance = null;
        let trackingInterval = null;
        // GLOBAL VARIABLE FOR DRIVER GPS LOOP
        let driverLocationInterval = null;
        // 📍 1. DEFAULT CONTEXT (Will be updated by GPS)
        let currentCityContext = "India";

        // 🔄 SYNC DATA: Get latest Admin approvals
        async function refreshUser() {
            if(!currentUser) return;
            try {
                const res = await fetch(`/api/user/me/${currentUser.username}`);
                const data = await res.json();
                if(res.ok) {
                    currentUser = data.user;
                    localStorage.setItem('carpoolUser', JSON.stringify(currentUser));
                    
                    // Update Badge UI immediately
                    updateNavForUser(); 
                    checkVehicleStatus();
                }
            } catch(e) { console.error("Sync failed"); }
        }

        // --- INIT ---
        document.addEventListener('DOMContentLoaded', () => {
            const saved = localStorage.getItem('carpoolUser');
            if(saved) {
                currentUser = JSON.parse(saved);
                updateNavForUser(); // Just update buttons, don't auto-hide landing yet
            }
        });

        // --- VIEW SWITCHING ---
        function showHome() {
            document.getElementById('landing-page').classList.remove('d-none');
            document.getElementById('app-container').classList.add('d-none');
            window.scrollTo(0,0);
        }

        function enterApp() {
            if(!currentUser) return openAuthModal('login');
            document.getElementById('landing-page').classList.add('d-none');
            document.getElementById('app-container').classList.remove('d-none');
            loadRides(); // Default view
        }

        function updateNavForUser() {
            document.querySelectorAll('.public-only').forEach(e => e.classList.add('d-none'));
            document.getElementById('auth-buttons').classList.add('d-none');
            document.getElementById('user-profile-nav').classList.remove('d-none');
            document.getElementById('nav-username').innerText = currentUser.fullName;
            document.getElementById('dashboard-user').innerText = currentUser.fullName;
            
            // Admin Check
            if(currentUser.isAdmin) document.getElementById('admin-link').classList.remove('d-none');
            
            // Profile Fill
            document.getElementById('profile-name').innerText = currentUser.fullName;
            document.getElementById('profile-phone').value = currentUser.phone || '';
        }

        function switchView(v) {
        refreshUser(); // Sync admin approvals

        // 1. Update Sidebar UI
        document.querySelectorAll('.sidebar .nav-link').forEach(e => e.classList.remove('active'));
        if(event && event.currentTarget) event.currentTarget.classList.add('active');
        
        // 2. Hide ALL possible views first
        const allViews = ['market', 'post', 'dashboard', 'trips', 'profile'];
        allViews.forEach(id => {
            const el = document.getElementById('view-' + id);
            if(el) el.classList.add('d-none');
        });

        // 3. Show the requested view
        const targetView = document.getElementById('view-' + v);
        if(targetView) {
            targetView.classList.remove('d-none');
        } else {
            console.error("View not found: view-" + v);
        }
        
        // 4. Update Header Title
        const titles = { 
            market: 'Marketplace', 
            post: 'Offer Ride', 
            dashboard: 'Driver Console', 
            trips: 'My Trips', 
            profile: 'My Profile' 
        };
        document.getElementById('page-title').innerText = titles[v] || 'Dashboard';

        // 5. Trigger Data Loading
        if(v === 'market') loadRides();
        if(v === 'dashboard') loadDriverDashboard();
        if(v === 'trips') loadTrips();
        if(v === 'profile') { checkVehicleStatus(); renderPhoneUI(); }
        if(v === 'post') preparePostRideForm();
    }
        // --- AUTH ---
        authModal = new bootstrap.Modal(document.getElementById('authModal'));
        
        function openAuthModal(mode) {
            authModal.show();
            toggleAuthForms(mode);
        }

        function toggleAuthForms(mode) {
            document.getElementById('authTitle').innerText = mode==='login' ? 'Sign In' : 'Create Account';
            document.getElementById('login-form').classList.toggle('d-none', mode!=='login');
            document.getElementById('register-form').classList.toggle('d-none', mode!=='register');
            document.getElementById('otp-form').classList.add('d-none');
        }

        async function login() {
            const btn = event.currentTarget; // Get the clicked button
            const originalText = btn.innerHTML;
    
            // 1. Show Spinner
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
            const u = document.getElementById('login-user').value;
            const p = document.getElementById('login-pass').value;
            try {
                const res = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u, password:p})});
                const data = await res.json();
                if(res.ok) {
                    currentUser = data.user;
                    localStorage.setItem('carpoolUser', JSON.stringify(currentUser));
                    authModal.hide();
                    updateNavForUser();
                    enterApp();
                } else alert(data.error);
            } catch(e) { showToast("Error", "Server unavailable", "error"); }
            finally {
                // 2. Always reset button (even if error)
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        async function register() {
    const n = document.getElementById('reg-name').value;
    const u = document.getElementById('reg-user').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;

    if(!n || !u || !e || !p) return showToast("Missing Info", "Please fill in all fields.", "error");

    try {
        const res = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ fullName: n, username: u, email: e, password: p }) 
        });

        // ✅ FIX 1: You must define 'data' by parsing the response here
        const data = await res.json(); 

        if (res.ok) { 
            // --- BYPASS LOGIC ---
            if (data.isDemo) {
                showToast("Demo Mode", `OTP is: ${data.otp}`, "info");
                // ✅ FIX 2: Correct ID is 'otp-input' (from your index.html)
                const otpInput = document.getElementById('otp-input'); 
                if (otpInput) otpInput.value = data.otp;
            } else {
                showToast("Success", "OTP sent to your email!", "success");
            }

            // ✅ FIX 3: These lines were never reached before because of the crash
            document.getElementById('register-form').classList.add('d-none');
            document.getElementById('otp-form').classList.remove('d-none');
            document.getElementById('otp-email').value = e;
        } else {
            showToast("Error", data.error || "Registration failed", "error");
        }
    } catch (error) {
        showToast("Error", "Server unavailable", "error");
    }
}

        async function submitOTP() {
            const e = document.getElementById('otp-email').value;
            const o = document.getElementById('otp-input').value;
            const res = await fetch('/api/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:e, otp:o})});
            if(res.ok) { alert("Verified! Please Login."); toggleAuthForms('login'); } else alert("Invalid OTP");
        }

        function logout() {
            localStorage.removeItem('carpoolUser');
            location.reload();
        }

        // --- MAP & CALCULATION ---
        // 🌍 MAP & ROUTING UTILITIES 🌍

        // 1. FOR POST RIDE SCREEN (Calculate Button)
        async function calculateDistance() {
            const cityA = document.getElementById('from').value;
            const cityB = document.getElementById('to').value;

            if(!cityA || !cityB) return alert(`Please enter locations in ${currentCityContext}.`);

            // UI Loading
            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';
            btn.disabled = true;

            // 🧠 SMART SEARCH HELPER (The Fix)
            const getAndSaveCoords = async (loc, type) => {
                try {
                    // 1. Try Specific Search: "Location, City"
                    let query = `${loc}, ${currentCityContext}`; 
                    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
                    
                    let res = await fetch(url);
                    let data = await res.json();

                    // 2. Fallback: If not found, try generic search in India
                    if(!data || data.length === 0) {
                        console.warn(`'${query}' not found. Retrying generic search...`);
                        url = `https://nominatim.openstreetmap.org/search?format=json&q=${loc}&countrycodes=in&limit=1`;
                        res = await fetch(url);
                        data = await res.json();
                    }

                    if(data && data[0]) {
                        // Found it! Save exact Coords
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        
                        // Save to hidden inputs (for Post Ride)
                        const latInput = document.getElementById(`post-${type}-lat`);
                        const lonInput = document.getElementById(`post-${type}-lon`);
                        if(latInput) latInput.value = lat;
                        if(lonInput) lonInput.value = lon;
                        
                        return { lat, lon, name: data[0].display_name };
                    }
                } catch(e) { console.error(e); }
                return null;
            };

            // Run Search
            const c1 = await getAndSaveCoords(cityA, 'from');
            const c2 = await getAndSaveCoords(cityB, 'to');

            if(c1 && c2) {
                // Success! Draw Route
                drawRouteOnMap(c1, c2, cityA, cityB);

                // Calculate Distance & Price
                try {
                     const rUrl = `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`;
                     const rRes = await fetch(rUrl);
                     const rData = await rRes.json();
                     
                     if(rData.routes.length) {
                        const distKm = (rData.routes[0].distance / 1000).toFixed(1);
                        
                        // Update Distance Input
                        const distInput = document.getElementById('distance');
                        if(distInput) distInput.value = distKm;
                        
                        // --- FIX START ---
                        // 1. Get the user's rate, or default to 5 if empty
                        const rateInput = document.getElementById('ratePerKm');
                        let rate = rateInput.value ? parseFloat(rateInput.value) : 5;
                        
                        // 2. Auto-fill the input with 5 if it was empty, so the user sees it
                        if(!rateInput.value) rateInput.value = 5;

                        // 3. Calculate Price using the RATE, not hardcoded 5
                        const priceInput = document.getElementById('price');
                        if(priceInput) priceInput.value = Math.ceil(distKm * rate); 
                        // --- FIX END ---
                    }
                } catch(e) {}
            } else {
                alert(`❌ Could not find location in ${currentCityContext}. Try adding a nearby landmark.`);
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
        }

        // 2. FOR RIDE CARDS ("View Route" Button)
        async function calculateDistanceByCoords(fromName, toName) {
            // This function takes the names, finds coords, and shows the map
            const getC = async (q) => {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=in&limit=1`);
                const d = await res.json();
                return d[0] ? {lat: d[0].lat, lon: d[0].lon} : null;
            };

            const c1 = await getC(fromName);
            const c2 = await getC(toName);

            if(c1 && c2) {
                drawRouteOnMap(c1, c2, fromName, toName);
            } else {
                alert("Could not load route map for these locations.");
            }
        }

        // 3. SHARED MAP DRAWER (The Core Logic)
        async function drawRouteOnMap(c1, c2, labelA, labelB) {
            // Open Modal
            const modalEl = document.getElementById('mapModal');
            const mapModal = new bootstrap.Modal(modalEl);
            mapModal.show();

            // Wait for modal to be visible
            modalEl.addEventListener('shown.bs.modal', async function init() {
                modalEl.removeEventListener('shown.bs.modal', init);

                // Reset Map
                if(mapInstance) { mapInstance.remove(); mapInstance = null; }
                
                // Create Map
                mapInstance = L.map('routeMap').setView([c1.lat, c1.lon], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);

                // Add Markers
                L.marker([c1.lat, c1.lon]).addTo(mapInstance).bindPopup(`<b>Start:</b> ${labelA}`).openPopup();
                L.marker([c2.lat, c2.lon]).addTo(mapInstance).bindPopup(`<b>End:</b> ${labelB}`);

                // Draw Line (OSRM)
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=full&geometries=geojson`;
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    if(data.routes.length) {
                        const line = L.geoJSON(data.routes[0].geometry, {
                            style: { color: 'blue', weight: 5 }
                        }).addTo(mapInstance);
                        
                        mapInstance.fitBounds(line.getBounds(), {padding:[50,50]});
                    }
                } catch(e) { console.error("Routing failed", e); }
            });
        }

        function calculateFinalPrice() {
            const d = document.getElementById('distance').value;
            const r = document.getElementById('ratePerKm').value;
            if(d && r) document.getElementById('price').value = Math.round(d*r);
        }

        // --- RIDE ACTIONS ---
        // --- RIDE ACTIONS (With Strict Validation) ---
        async function postRide() {
            // 🛑 CLIENT CHECK: Block immediately if not verified
            if (!currentUser.vehicle || !currentUser.vehicle.isVerified) {
                alert("⛔ RESTRICTED: You cannot post a ride until your vehicle is approved by Admin.");
                switchView('profile'); 
                return;
            }
            // 1. GET VALUES DIRECTLY
            const lat1 = document.getElementById('post-from-lat').value;
            const lon1 = document.getElementById('post-from-lon').value;
            const lat2 = document.getElementById('post-to-lat').value;
            const lon2 = document.getElementById('post-to-lon').value;
            console.log("📍 Coordinates Detected:", { lat1, lon1, lat2, lon2 });

            // 🛑 STRICT CHECK
            if (!lat1 || !lon1 || !lat2 || !lon2) {
                showToast("GPS Error", "Please click 'Calculate Route' first.", "error");
                return;
            }

            // 🛑 2. COORDINATE LOCK (The Fix)
            // This prevents "Ride data missing coordinates" error forever
            const latCheck = document.getElementById('post-from-lat').value;
            if(!latCheck) {
                return alert("⚠️ GPS Data Missing! Please click the Map/Search button to calculate the route first.");
            }
            // Process Stops: Split by comma and clean up spaces
            const rawStops = document.getElementById('stops').value;
            const stopsArray = rawStops ? rawStops.split(',').map(s => s.trim()) : [];

            // 1. Collect Data (Updated IDs)
            const d = {
                driver: currentUser.fullName,
                driverUsername: currentUser.username, 
                from: document.getElementById('from').value,
                to: document.getElementById('to').value,
                
                

                // 📍 SEND EXACT COORDS (Parsed as Numbers)
                fromLat: parseFloat(document.getElementById('post-from-lat').value),
                fromLon: parseFloat(document.getElementById('post-from-lon').value),
                toLat: parseFloat(document.getElementById('post-to-lat').value),
                toLon: parseFloat(document.getElementById('post-to-lon').value),

                stops: document.getElementById('stops').value ? document.getElementById('stops').value.split(',') : [],
                // 🔢 PARSE NUMBERS SAFELY
                seats: parseInt(document.getElementById('seats').value),
                price: parseInt(document.getElementById('price').value),
                
                travelDate: document.getElementById('travelDate').value,
                travelTime: document.getElementById('travelTime').value,
                
                // 🔒 READ LOCKED FIELDS (New IDs)
                vehicleType: document.getElementById('post-vehicle-type').value, // <--- FIXED HERE
                vehicleModel: document.getElementById('vehicleModel').value,
                
                vibe: document.getElementById('vibe').value
            };

            // 2. 🛑 VALIDATION
            if(!d.from || !d.to || !d.travelDate || !d.travelTime || !d.price) {
                return alert("⚠️ Please fill in all the details.");
            }

            // Double check safety logic just in case
            if (d.vehicleType === 'Bike' && d.seats > 1) return alert("❌ Bikes allow max 1 passenger.");
            if (d.price < 0) return alert("❌ Price cannot be negative.");

            // 3. SEND TO SERVER
            try {
                const res = await fetch('/api/rides', {
                    method: 'POST', 
                    headers: {'Content-Type':'application/json'}, 
                    body: JSON.stringify(d)
                });
                
                if(res.ok) {
                    alert("✅ Ride Published Successfully!"); 
                    switchView('dashboard'); // ✅ Sends you to your Driver Console
                } else {
                    const errData = await res.json();
                    alert("❌ Error: " + (errData.error || "Could not post ride"));
                }
            } catch(e) {
                console.error(e);
                alert("Server Connection Error");
            }
        }
        async function loadRides() {
            const res = await fetch('/api/rides');
            renderRides(await res.json());
        }

        async function searchRides() {
            const btn = document.querySelector('#view-market button'); // The search button
            const originalText = btn.innerHTML;
            
            // 1. Show Loading
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;

            const q = document.getElementById('searchInput').value;
            
            try {
                const res = await fetch(`/api/rides/search?to=${q}`);
                const data = await res.json();
                renderRides(data);
                
                if(data.length === 0) {
                    showToast("No Rides", `No rides found for '${q}'. Try a different city.`, "info");
                }
            } catch(e) {
                showToast("Error", "Search failed.", "error");
            } finally {
                // 2. Restore Button
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        function renderRides(rides) {
        const list = document.getElementById('rides-list'); 
        list.innerHTML = '';
        
        if(!rides.length) return list.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="mb-3 opacity-50"><i class="fas fa-leaf fa-4x text-success"></i></div>
                <h5 class="fw-bold text-muted">No rides found</h5>
                <p class="text-muted small">Try searching for a different city or date.</p>
            </div>`;
    
        rides.forEach(r => {
            const isFull = r.seats <= 0;
            const isMine = currentUser && r.driver === currentUser.fullName;
            
            // 🌿 Natural Icons
            const vIcon = r.vehicleType === 'Bike' ? 'fa-motorcycle' : 'fa-car';
            
            // Green Theme Buttons
            const btnClass = isFull ? 'btn-secondary' : 'btn-primary';
            const btnText = isFull ? 'Full' : 'Request Seat';
            
            let actionBtn = isMine 
                ? `<button onclick="deleteRide('${r._id}')" class="btn btn-outline-danger w-100 rounded-pill fw-bold">Delete Ride</button>` 
                : `<button onclick="openBookModal('${r._id}','${r.driver}','${r.price}')" class="btn ${btnClass} w-100 rounded-pill fw-bold shadow-sm" ${isFull?'disabled':''}>${btnText}</button>`;

            list.innerHTML += `
            <div class="col-md-6 col-lg-4">
                <div class="pro-card h-100 d-flex flex-column p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <span class="ride-price-badge">₹${r.price}</span>
                        <span class="badge ${isFull ? 'bg-secondary' : 'badge-soft'} px-3 py-2 rounded-pill border">
                            <i class="fas fa-leaf me-1"></i> ${r.seats} seats
                        </span>
                    </div>

                    <div class="location-timeline flex-grow-1">
                        <div class="timeline-dot top"></div>
                        <div class="mb-4">
                            <div class="text-muted small fw-bold text-uppercase" style="font-size: 0.7rem; color: #64748b;">FROM</div>
                            <h5 class="fw-bold m-0 text-dark">${r.from}</h5>
                        </div>
                        
                        <div class="timeline-dot bottom"></div>
                        <div>
                            <div class="text-muted small fw-bold text-uppercase" style="font-size: 0.7rem; color: #64748b;">TO</div>
                            <h5 class="fw-bold m-0 text-dark">${r.to}</h5>
                        </div>
                    </div>

                    <div class="d-flex align-items-center gap-3 my-4 bg-light p-3 rounded-3" style="background: #f0fdf4 !important;">
                        <div class="avatar-circle bg-white shadow-sm text-success">
                            <i class="fas ${vIcon}"></i>
                        </div>
                        <div class="lh-1">
                            <div class="fw-bold text-dark mb-1">${r.driver}</div>
                            <div class="small text-muted d-flex gap-2">
                                <span><i class="fas fa-star text-warning"></i> ${r.driverRating || '5.0'}</span>
                                <span>•</span>
                                <span>${r.vehicleModel}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-auto">
                        <div class="d-flex gap-3 text-muted small mb-3">
                            <span><i class="fas fa-calendar-day me-1 text-success"></i> ${formatDateNice(r.travelDate)}</span>
                            <span><i class="fas fa-clock me-1 text-success"></i> ${r.travelTime}</span>
                        </div>
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
        });
    }


        // --- BOOKING ---
        function openBookModal(id, dr, pr) {
            document.getElementById('modal-driver').innerText = dr;
            document.getElementById('modal-price').innerText = '₹'+pr;
            document.getElementById('modal-ride-id').value = id;
            new bootstrap.Modal(document.getElementById('bookingModal')).show();
        }

        async function confirmBooking() {
            const id = document.getElementById('modal-ride-id').value;
            const dr = document.getElementById('modal-driver').innerText;
            const pr = document.getElementById('modal-price').innerText.replace('₹','');
            
            // Get Pickup Point
            const pickup = document.getElementById('modal-pickup').value || "Agreed Location";

            await fetch('/api/requests', {
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({
                    rideId: id, 
                    passenger: currentUser.username, 
                    driver: dr, 
                    pickupPoint: pickup, // <--- Send it
                    rideDetails: {price:pr}
                })
            });
            
            bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
            alert("Request Sent! Wait for driver approval."); 
            switchView('trips');
        }

        // --- DRIVER & TRIPS ---
        async function loadDriver() {
            // 1. Load Requests
            const res = await fetch(`/api/requests/driver/${currentUser.fullName}`);
            const reqs = await res.json();
            const list = document.getElementById('requests-list'); list.innerHTML='';
            const valid = reqs.filter(r => r.passenger !== currentUser.username);
            
            if(!valid.length) list.innerHTML = '<div class="p-4 text-center text-muted bg-white rounded border">No pending requests.</div>';
            
            valid.forEach(r => {
                const isAccepted = r.status === 'accepted';
                
                let btns = '';
                if(isAccepted) {
                    btns = `<span class="badge bg-success"><i class="fas fa-check"></i> Accepted</span>`;
                } else {
                    btns = `
                    <button onclick="handleReq('${r._id}','accept')" class="btn btn-success btn-sm me-1">Accept</button>
                    <button onclick="handleReq('${r._id}','reject')" class="btn btn-outline-danger btn-sm">Reject</button>`;
                }

                list.innerHTML += `
                <div class="pro-card p-3 mb-2">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h6 class="m-0 fw-bold">${r.passenger}</h6>
                            <small class="text-danger fw-bold"><i class="fas fa-map-marker-alt"></i> Pickup: ${r.pickupPoint}</small>
                        </div>
                        <div class="text-end">${btns}</div>
                    </div>
                </div>`;
            });

            // 2. Load MY RIDES (With Start Button)
            const rideRes = await fetch('/api/rides');
            const all = await rideRes.json();
            const my = all.filter(r => r.driver === currentUser.fullName);
            const myList = document.getElementById('my-posted-list'); myList.innerHTML='';
            
            my.forEach(r => {
                let statusBtn = '';
                if(r.status === 'scheduled') {
                    statusBtn = `<button onclick="updateRideStatus('${r._id}', 'started')" class="btn btn-success btn-sm w-100 mb-2">Start Ride</button>`;
                } else if (r.status === 'started') {
                    statusBtn = `<button onclick="updateRideStatus('${r._id}', 'completed')" class="btn btn-dark btn-sm w-100 mb-2">End Ride</button>`;
                } else {
                    statusBtn = `<button disabled class="btn btn-secondary btn-sm w-100 mb-2">Completed</button>`;
                }

                myList.innerHTML += `
                <div class="pro-card p-3 mb-2">
                    <div class="d-flex justify-content-between mb-2">
                        <strong>${r.from} ➔ ${r.to}</strong>
                        <span class="badge bg-light text-dark border">${r.status}</span>
                    </div>
                    ${statusBtn}
                </div>`;
            });
        }

        async function updateRideStatus(id, status) {
            if(!confirm(`Mark ride as ${status}?`)) return;

            // 1. Tell Server status changed
            await fetch(`/api/rides/${id}/status`, {
                method: 'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ status })
            });

            // 2. 🟢 IF STARTING: Start Broadcasting GPS
            if (status === 'started') {
                alert("✅ Ride Started! Your location is being shared with passengers.");
                
                if (navigator.geolocation) {
                    // Send location every 5 seconds
                    driverLocationInterval = setInterval(() => {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                            const lat = pos.coords.latitude;
                            const lon = pos.coords.longitude;
                            
                            // Send to Server
                            await fetch(`/api/rides/${id}/location`, {
                                method: 'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({ lat, lon })
                            });
                            
                            console.log("📍 Sent Location:", lat, lon);
                        });
                    }, 5000); // 5 Seconds
                }
            }

            // 3. 🔴 IF ENDING: Stop Broadcasting
            if (status === 'completed') {
                if (driverLocationInterval) clearInterval(driverLocationInterval);
                alert("🏁 Ride Ended.");
            }

            loadDriver(); // Refresh UI
        }

        async function handleReq(id, act) { await fetch(`/api/requests/${id}/${act}`, {method:'POST'}); loadDriver(); }

        async function loadTrips() {
            // 1. Fetch requests made by the current user (Passenger)
            const res = await fetch(`/api/requests/passenger/${currentUser.username}`);
            const reqs = await res.json();
            const list = document.getElementById('my-requests-list'); 
            list.innerHTML = ''; // Clear previous list
            
            // 2. Handle Empty State
            if(!reqs.length) {
                list.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="text-muted mb-3"><i class="fas fa-ticket-alt fa-3x opacity-25"></i></div>
                    <h5 class="fw-bold text-muted">No trips booked yet</h5>
                    <p class="small text-muted">Search for a ride and book a seat to see it here.</p>
                    <button onclick="switchView('market')" class="btn btn-outline-primary btn-sm rounded-pill mt-2">Find a Ride</button>
                </div>`;
                return;
            }

            // 3. Fetch ALL rides to check their status (Started/Completed)
            let allRides = [];
            try {
                const rideRes = await fetch(`/api/rides`); 
                allRides = await rideRes.json();
            } catch(e) { console.error("Could not sync ride status"); }

            // 4. Loop through requests and render cards
            for(const r of reqs) {
                // Find the ride associated with this request to check its live status
                const thisRide = allRides.find(x => x._id === r.rideId);
                
                let rideStatus = 'scheduled'; 
                
                if(thisRide) {
                    rideStatus = thisRide.status;
                }

                let st = r.status || 'pending';
                let col = st === 'accepted' ? 'success' : (st === 'pending' ? 'warning' : 'danger');
                
                let actionHtml = '';
                
                // --- LOGIC FOR BUTTONS ---
                if(st === 'accepted') {
                    if(rideStatus === 'started') {
                        // 🟢 LIVE TRACKING BUTTON (Corrected Logic)
                        actionHtml = `
                        <div class="alert alert-success py-2 small mb-2">
                            <i class="fas fa-satellite-dish me-2 fa-spin"></i> Driver has departed!
                        </div>
                        <button onclick="startLiveTracking('${thisRide ? thisRide._id : ''}')" class="btn btn-primary w-100 rounded-pill mb-2 shadow-sm pulse-anim">
                            <i class="fas fa-map-marked-alt me-2"></i> Track Live
                        </button>`;
                    } else if(rideStatus === 'completed') {
                            // 🟢 CHECK PAYMENT STATUS
                            if (thisRide.paymentStatus === 'paid') {
                                actionHtml = `
                                <div class="alert alert-success py-2 small mb-2 text-center">
                                    <i class="fas fa-check-circle me-1"></i> <strong>Paid</strong>
                                </div>
                                <button class="btn btn-outline-dark btn-sm w-100" disabled>
                                    <i class="fas fa-file-invoice me-1"></i> Receipt Sent
                                </button>`;
                            } else {
                                // 🔴 RIDE DONE, BUT NOT PAID -> SHOW PAY BUTTON
                                actionHtml = `
                                <div class="alert alert-warning py-2 small mb-2 text-center">
                                    <i class="fas fa-exclamation-circle me-1"></i> Payment Pending
                                </div>
                                <button onclick="openPaymentModal('${thisRide._id}', '${thisRide.price}', '${thisRide.driver}')" class="btn btn-success w-100 rounded-pill fw-bold shadow-sm pulse-anim">
                                    Pay ₹${thisRide.price}
                                </button>`;
                            }
                    } else {
                        actionHtml = `<div class="alert alert-info py-2 small mb-2">Scheduled</div>`;
                    }
                    
                    if(r.driverPhone) {
                        actionHtml += `<a href="tel:${r.driverPhone}" class="btn btn-outline-success btn-sm w-100 mb-2"><i class="fas fa-phone"></i> Call Driver</a>`;
                    }
                } else if (st === 'pending') {
                    actionHtml = `<button onclick="cancelReq('${r._id}')" class="btn btn-outline-danger btn-sm w-100">Cancel Request</button>`;
                }

                // --- RENDER HTML ---
                list.innerHTML += `
                <div class="col-md-6 col-lg-4">
                    <div class="pro-card overflow-hidden h-100">
                        <div class="d-flex h-100">
                            <div class="ticket-stub p-3 d-flex flex-column align-items-center justify-content-center bg-light" style="width: 90px; border-right: 2px dashed #ccc;">
                                <i class="fas fa-ticket-alt fa-2x text-muted opacity-50 mb-2"></i>
                                <span class="badge bg-${col} text-uppercase" style="font-size: 0.6rem;">${st}</span>
                            </div>
                            
                            <div class="p-3 flex-grow-1 d-flex flex-column">
                                <h6 class="fw-bold mb-1">Driver: ${r.driver}</h6>
                                <p class="text-muted small mb-2">
                                    <i class="fas fa-map-pin text-danger me-1"></i> Pickup: <strong>${r.pickupPoint || 'Not set'}</strong>
                                </p>
                                
                                <div class="mt-auto">
                                    ${actionHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        }
        
        async function cancelReq(id) { if(confirm("Cancel?")) { await fetch(`/api/requests/${id}/cancel`, {method:'POST'}); loadTrips(); } }
        async function updateProfile() { 
            const p = document.getElementById('profile-phone').value;
            await fetch('/api/user/update', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:currentUser.username, phone:p})});
            currentUser.phone = p; localStorage.setItem('carpoolUser', JSON.stringify(currentUser)); alert("Saved!");
        }
        async function deleteRide(id) { if(confirm("Delete?")) { await fetch(`/api/rides/${id}`, {method:'DELETE'}); loadRides(); } }
        
        // Helper to reuse map logic for "View Route" on existing cards

        // 1. UPDATED REGISTER FUNCTION
        async function registerVehicle() {
            const model = document.getElementById('reg-model').value;
            const plate = document.getElementById('reg-plate').value;
            const type = document.getElementById('reg-type').value; // <--- Get Type
            
            if(!model || !plate) return alert("Please fill all details");
            
            const res = await fetch('/api/user/vehicle', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    username: currentUser.username,
                    model, plateNumber: plate, type // <--- Send Type
                })
            });
            
            if(res.ok) {
                alert("Submitted! Admin will verify shortly.");
                refreshUser(); // Reload data
            }
        }

        // 2. UPDATED "PREPARE POST RIDE" LOGIC
        // Call this inside switchView('post')
        function preparePostRideForm() {
            if(!currentUser.vehicle || !currentUser.vehicle.isVerified) return;

            const vType = currentUser.vehicle.type || 'Car'; // Default to Car if missing
            const vModel = currentUser.vehicle.model;

            // A. Pre-fill and Lock Inputs
            document.getElementById('post-vehicle-type').value = vType;
            document.getElementById('vehicleModel').value = vModel;

            // B. Set Seat Constraints
            const seatInput = document.getElementById('seats');
            const seatHint = document.getElementById('seat-hint');

            if(vType === 'Bike') {
                seatInput.max = 1;
                seatInput.value = 1;
                seatInput.disabled = true; // Lock it because bikes can ONLY have 1 passenger
                seatHint.innerText = "Fixed: 1 Passenger for Bike";
            } else {
                seatInput.max = 4;
                seatInput.value = 1; // Reset to 1
                seatInput.disabled = false;
                seatHint.innerText = "Max 4 Passengers for Car";
            }
        }

        // Update the updateNavForUser or similar function to check status
        function checkVehicleStatus() {
            const statusDiv = document.getElementById('vehicle-status');
            const badge = document.getElementById('vehicle-status-badge');
            const modelInput = document.getElementById('reg-model');
            const plateInput = document.getElementById('reg-plate');
            const submitBtn = document.getElementById('btn-reg-vehicle');

            // Set Username (Small fix for the left card)
            if(document.getElementById('profile-username')) {
                document.getElementById('profile-username').innerText = currentUser.username;
            }

            // 1. NO DATA (New Driver)
            if(!currentUser.vehicle || !currentUser.vehicle.model) {
                badge.className = "badge bg-secondary rounded-pill px-3 py-2";
                badge.innerText = "Not Registered";
                
                statusDiv.className = "alert alert-light border-start border-4 border-warning mb-4";
                statusDiv.innerHTML = `<div class="d-flex gap-3"><i class="fas fa-exclamation-triangle fa-lg mt-1 text-warning"></i><div><strong>Driver Status: Inactive</strong><div class="small text-muted">Please register your vehicle below.</div></div></div>`;
                
                modelInput.disabled = false;
                plateInput.disabled = false;
                submitBtn.disabled = false;
                submitBtn.innerText = "Submit for Approval";
                return;
            }

            // Pre-fill
            modelInput.value = currentUser.vehicle.model;
            plateInput.value = currentUser.vehicle.plateNumber;

            // 2. CHECK STATUS
            if(currentUser.vehicle.isVerified) {
                // ✅ APPROVED
                badge.className = "badge bg-success rounded-pill px-3 py-2";
                badge.innerText = "Verified Driver";

                statusDiv.className = "alert alert-success bg-opacity-10 border-success mb-4";
                statusDiv.innerHTML = `<div class="d-flex gap-3"><i class="fas fa-check-circle fa-lg mt-1 text-success"></i><div><strong>You are a Verified Driver!</strong><div class="small">You can now post rides freely.</div></div></div>`;

                // Lock inputs
                modelInput.disabled = true;
                plateInput.disabled = true;
                submitBtn.disabled = true;
                submitBtn.className = "btn btn-success w-100 py-3 rounded-3 fw-bold";
                submitBtn.innerHTML = '<i class="fas fa-check me-2"></i> Approved';
            } else {
                // ⏳ PENDING
                badge.className = "badge bg-warning text-dark rounded-pill px-3 py-2";
                badge.innerText = "Pending Approval";

                statusDiv.className = "alert alert-warning bg-opacity-10 border-warning mb-4";
                statusDiv.innerHTML = `<div class="d-flex gap-3"><i class="fas fa-clock fa-lg mt-1 text-warning"></i><div><strong>Application Under Review</strong><div class="small">Admin is verifying your details.</div></div></div>`;
                
                modelInput.disabled = true;
                plateInput.disabled = true;
                submitBtn.disabled = true;
                submitBtn.innerText = "Waiting for Admin...";
            }
        }

        // 📱 PHONE LOGIC

        async function sendPhoneOtp() {
            const phoneInput = document.getElementById('profile-phone');
            const phone = phoneInput.value.trim(); // Remove extra spaces

            // 🛑 VALIDATION RULES
            
            // Rule 1: Must be numbers only
            if (!/^\d+$/.test(phone)) {
                return alert("⚠️ Invalid Format: Please enter numbers only.");
            }

            // Rule 2: Must be exactly 10 digits
            if (phone.length !== 10) {
                return alert("⚠️ Invalid Length: Phone number must be exactly 10 digits.");
            }

            // Rule 3: (Optional) Must start with 6, 7, 8, or 9 (Indian Standard)
            if (!/^[6-9]/.test(phone)) {
                return alert("⚠️ Invalid Number: Please enter a valid Indian mobile number (starting with 6-9).");
            }

            // ✅ If all checks pass, send OTP
            const res = await fetch('/api/user/phone/send-otp', {
                method: 'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ username: currentUser.username, phone })
            });

            if(res.ok) {
                alert("OTP Sent! (Check your VS Code Terminal)");
                document.getElementById('btn-send-otp').classList.add('d-none'); 
                document.getElementById('phone-otp-section').classList.remove('d-none'); 
                phoneInput.disabled = true; // Lock the input so they can't change it
            } else {
                alert("Error sending OTP. Please try again.");
            }
        }

        async function verifyPhoneOtp() {
            const otp = document.getElementById('phone-otp-input').value;
            const res = await fetch('/api/user/phone/verify-otp', {
                method: 'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ username: currentUser.username, otp })
            });

            if(res.ok) {
                const data = await res.json();
                currentUser = data.user; // Update local user
                localStorage.setItem('carpoolUser', JSON.stringify(currentUser));
                
                alert("✅ Phone Verified Successfully!");
                renderPhoneUI(); // Refresh UI
            } else {
                alert("❌ Invalid OTP");
            }
        }

        function renderPhoneUI() {
            // Check current status and update UI accordingly
            if (currentUser.isPhoneVerified) {
                document.getElementById('phone-input-group').classList.add('d-none');
                document.getElementById('phone-otp-section').classList.add('d-none');
                
                const badge = document.getElementById('phone-verified-badge');
                badge.classList.remove('d-none');
                badge.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${currentUser.phone} <span class="float-end fw-bold">Verified</span>`;
            } else {
                // If existing user has a saved phone but not verified
                if(currentUser.phone && currentUser.phone !== "Not set") {
                    document.getElementById('profile-phone').value = currentUser.phone;
                }
            }
        }

        // 📍 2. DETECT USER'S CITY AUTOMATICALLY
        function detectUserLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    try {
                        // Reverse Geocode: Turn Lat/Lon into City Name
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await res.json();
                        
                        // Extract City/Town/Village
                        const address = data.address;
                        currentCityContext = address.city || address.town || address.village || address.county || "India";
                        
                        console.log("📍 GPS Locked to City:", currentCityContext);
                        
                        // Update Search Bar Placeholder to show we know the city
                        const searchInput = document.getElementById('searchInput');
                        if(searchInput) searchInput.placeholder = `Search rides in ${currentCityContext}...`;

                    } catch (e) { console.error("GPS City Detect Failed", e); }
                }, () => {
                    alert("⚠️ Location access denied. Search will default to all of India.");
                });
            }
        }

        // Run detection immediately on load
        document.addEventListener('DOMContentLoaded', detectUserLocation);

        // 🛰️ LIVE TRACKING SIMULATOR
        // 🌍 GLOBAL MAP VARIABLE (Make sure this is at the top of your script)

        // 🌍 GLOBAL VARIABLES
        // Ensure these are at the very top of your script
        // let mapInstance = null; (Already defined? Don't duplicate)
        // let trackingInterval = null; (Already defined? Don't duplicate)

        // GLOBAL VARIABLES FOR MAP
        // let mapInstance = null; (Already defined at top)
        // let trackingInterval = null; (Already defined at top)

        async function startLiveTracking(rideId) {
            // 1. Initial Setup
            const modalEl = document.getElementById('mapModal');
            const mapModal = new bootstrap.Modal(modalEl);
            mapModal.show();

            modalEl.addEventListener('shown.bs.modal', async function initMap() {
                modalEl.removeEventListener('shown.bs.modal', initMap);

                // Reset Map
                if (mapInstance) { mapInstance.remove(); mapInstance = null; }
                if (trackingInterval) clearInterval(trackingInterval);

                // 2. Get Initial Ride Data to center map
                // (We fetch the basic info first to draw the static route line)
                const res = await fetch('/api/rides');
                const allRides = await res.json();
                const ride = allRides.find(r => r._id === rideId);

                // Create Map centered on Start Location
                mapInstance = L.map('routeMap').setView([ride.fromLat, ride.fromLon], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);

                // Draw the Blue Route Line (Optional, but looks good)
                const routeUrl = `https://router.project-osrm.org/route/v1/driving/${ride.fromLon},${ride.fromLat};${ride.toLon},${ride.toLat}?overview=full&geometries=geojson`;
                fetch(routeUrl).then(r => r.json()).then(data => {
                    if(data.routes.length) L.geoJSON(data.routes[0].geometry).addTo(mapInstance);
                });

                // 3. Create the Car Marker
                const carIcon = L.divIcon({
                    html: '<i class="fas fa-car-side fa-2x text-primary" style="text-shadow: 2px 2px 4px white;"></i>',
                    className: 'dummy', iconSize: [30, 30], iconAnchor: [15, 15]
                });
                // Start marker at the beginning
                const carMarker = L.marker([ride.fromLat, ride.fromLon], {icon: carIcon}).addTo(mapInstance);

                // 4. 🟢 START POLLING (The Real-Time Loop)
                // Check server every 5 seconds for new coordinates
                trackingInterval = setInterval(async () => {
                    try {
                        const locRes = await fetch(`/api/rides/${rideId}/location`);
                        const locData = await locRes.json();

                        if (locData.lat && locData.lon) {
                            // MOVE MARKER TO REAL LOCATION
                            const newLatLng = [locData.lat, locData.lon];
                            carMarker.setLatLng(newLatLng);
                            mapInstance.panTo(newLatLng); // Follow the car
                            console.log("📍 Car moved to:", newLatLng);
                        }
                        
                        if (locData.status === 'completed') {
                            clearInterval(trackingInterval);
                            alert("🏁 Driver has arrived!");
                        }
                    } catch (e) { console.error("Tracking Error", e); }
                }, 5000); 
            });

            // Cleanup on close
            modalEl.addEventListener('hidden.bs.modal', () => {
                if (trackingInterval) clearInterval(trackingInterval);
            });
        }


        // 💳 PAYMENT LOGIC

        let paymentPollInterval = null;

        function openPaymentModal(rideId, price, driverName) {
            currentPayRideId = rideId;
            document.getElementById('pay-amount').innerText = '₹' + price;
            document.getElementById('pay-driver').innerText = driverName;
            
            // 🧠 MAGICAL QR CODE GENERATION
            // 1. Get your Local IP (Hostname) so phone can reach laptop
            const host = window.location.hostname; 
            const port = window.location.port || '3000';
            
            // 2. Create the "Magic Link"
            const magicLink = `http://${host}:${port}/pay-confirm/${rideId}`;
            console.log("QR Link:", magicLink);

            // 3. Generate QR (Using API)
            const qrImg = document.querySelector('#paymentModal img');
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(magicLink)}`;
            
            new bootstrap.Modal(document.getElementById('paymentModal')).show();

            // 🟢 START POLLING: Check every 2 seconds if phone completed payment
            if (paymentPollInterval) clearInterval(paymentPollInterval);
            
            paymentPollInterval = setInterval(async () => {
                try {
                    // Check Ride Status
                    // (We reuse the existing location API or creating a tiny status API is cleaner, 
                    // but let's reuse the rides API for simplicity)
                    const res = await fetch('/api/rides');
                    const rides = await res.json();
                    const thisRide = rides.find(r => r._id === rideId);
                    
                    if (thisRide && thisRide.paymentStatus === 'paid') {
                        clearInterval(paymentPollInterval);
                        bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
                        alert("✨ Payment Confirmed via Mobile Scan!");
                        loadTrips(); // Refresh UI
                    }
                } catch(e) {}
            }, 2000);
        }

        // Stop polling when modal closes manually
        document.getElementById('paymentModal').addEventListener('hidden.bs.modal', () => {
            if (paymentPollInterval) clearInterval(paymentPollInterval);
        });

        async function processPayment() {
            const btn = document.getElementById('btn-confirm-pay');
            const spinner = document.getElementById('payment-spinner');
            
            btn.classList.add('d-none');
            spinner.classList.remove('d-none');

            // Get amount for receipt
            const amount = document.getElementById('pay-amount').innerText.replace('₹','');

            try {
                const res = await fetch(`/api/rides/${currentPayRideId}/pay`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        userEmail: currentUser.email, // <--- SEND EMAIL
                        amount: amount 
                    })
                });

                if (res.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
                    showToast("Payment Successful", "Receipt sent to " + currentUser.email, "success");
                    loadTrips(); 
                }
            } catch (e) { console.error(e); alert("Error"); }
            
            spinner.classList.add('d-none');
            btn.classList.remove('d-none');
        }
        function showToast(title, msg, type = 'success') {
        const toastEl = document.getElementById('appToast');
        const titleEl = document.getElementById('toast-title');
        const msgEl = document.getElementById('toast-msg');
        const iconEl = document.getElementById('toast-icon');

        // 1. Set Content
        titleEl.innerText = title;
        msgEl.innerText = msg;

        // 2. Set Style based on Type
        toastEl.className = `toast align-items-center border-0 shadow-lg text-white`;
        
        if (type === 'success') {
            toastEl.classList.add('bg-success'); // Green
            iconEl.className = 'fas fa-check-circle fa-lg';
        } else if (type === 'error') {
            toastEl.classList.add('bg-danger'); // Red
            iconEl.className = 'fas fa-exclamation-triangle fa-lg';
        } else {
            toastEl.classList.add('bg-primary'); // Blue
            iconEl.className = 'fas fa-info-circle fa-lg';
        }

        // 3. Show
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    function formatDateNice(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Reset hours to compare just the dates
        date.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        tomorrow.setHours(0,0,0,0);

        if (date.getTime() === today.getTime()) return "Today";
        if (date.getTime() === tomorrow.getTime()) return "Tomorrow";

        // Standard format: "Mon, 12 Oct"
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', day: 'numeric', month: 'short' 
        });
    }

    async function sendFeedback(event) {
        event.preventDefault(); // Stop page reload

        // 1. Get Values
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const msg = document.getElementById('contact-msg').value;
        const btn = document.getElementById('btn-contact');

        // 2. Show Loading Spinner
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';
        btn.disabled = true;

        try {
            // 3. Send to Server
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, email: email, message: msg })
            });

            const data = await res.json();

            if (res.ok) {
                showToast("Message Sent", "We have received your feedback!", "success");
                // Clear Form
                document.getElementById('contact-name').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-msg').value = '';
            } else {
                showToast("Error", data.error || "Failed to send message", "error");
            }
        } catch (e) {
            console.error(e);
            showToast("Network Error", "Could not connect to server.", "error");
        } finally {
            // 4. Reset Button
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
    
    async function loadDriverDashboard() {
    if (!currentUser) return;
    
    const activeRideContainer = document.getElementById('driver-active-ride');
    const requestsContainer = document.getElementById('driver-requests-list');
    
    // 1. Loading State
    activeRideContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div></div>';

    try {
        const [ridesRes, reqsRes] = await Promise.all([
            fetch('/api/rides'),
            fetch(`/api/requests/driver/${encodeURIComponent(currentUser.fullName)}`)
        ]);

        const allRides = await ridesRes.json();
        const requests = await reqsRes.json();

        // 2. Identify the Active Ride
        const myRide = allRides.find(r => 
            (r.driverUsername === currentUser.username || r.driver === currentUser.fullName) 
            && r.status !== 'completed'
        );

        // --- A. RENDER ACTIVE TRIP ---
        if (myRide) {
            const isLive = myRide.status === 'started';
            
            let actionBtn = !isLive 
                ? `<button onclick="updateRideStatus('${myRide._id}', 'started')" class="btn btn-success w-100 py-3 rounded-pill fw-bold shadow-sm">START JOURNEY ➔</button>`
                : `<div class="d-flex gap-2">
                    <button onclick="startLiveTracking('${myRide._id}')" class="btn btn-outline-primary flex-grow-1 py-2"><i class="fas fa-satellite-dish me-2"></i> Track Live</button>
                    <button onclick="updateRideStatus('${myRide._id}', 'completed')" class="btn btn-danger flex-grow-1 py-2">End Ride</button>
                   </div>`;

            activeRideContainer.innerHTML = `
                <div class="mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h3 class="fw-bold m-0">${myRide.from} <i class="fas fa-long-arrow-alt-right text-muted mx-2"></i> ${myRide.to}</h3>
                        <span class="badge ${isLive ? 'bg-success pulse-anim' : 'bg-warning text-dark'} px-3 py-2 rounded-pill">
                            ${myRide.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="text-muted small"><i class="fas fa-clock me-1"></i> Scheduled for ${myRide.travelTime}</div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-6">
                        <div class="p-3 border rounded-3 bg-light text-center">
                            <small class="text-muted text-uppercase fw-bold d-block mb-1" style="font-size:0.65rem;">Available Seats</small>
                            <h5 class="fw-bold m-0"><i class="fas fa-chair me-2 text-primary"></i>${myRide.seats}</h5>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="p-3 border rounded-3 bg-light text-center">
                            <small class="text-muted text-uppercase fw-bold d-block mb-1" style="font-size:0.65rem;">Total Fare</small>
                            <h5 class="fw-bold m-0 text-success">₹${myRide.price}</h5>
                        </div>
                    </div>
                </div>
                ${actionBtn}`;
        } else {
            activeRideContainer.innerHTML = `
                <div class="text-center py-5 opacity-50">
                    <i class="fas fa-car-side fa-3x mb-3"></i>
                    <p class="m-0">No active journey found.</p>
                    <button onclick="switchView('post')" class="btn btn-link text-success p-0">Post a ride now</button>
                </div>`;
        }

        // --- B. RENDER REQUESTS ---
        requestsContainer.innerHTML = requests.length ? '' : '<div class="p-4 text-center text-muted small">No pending passenger requests.</div>';
        
        requests.forEach(req => {
            requestsContainer.innerHTML += `
            <div class="list-group-item p-3 border-0 border-bottom bg-white">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong class="text-dark">${req.passenger}</strong>
                    <span class="badge bg-primary bg-opacity-10 text-primary small">New Request</span>
                </div>
                <div class="small text-muted mb-3">
                    <i class="fas fa-map-marker-alt text-danger me-1"></i> Pickup: <strong>${req.pickupPoint}</strong>
                </div>
                <div class="d-flex gap-2">
                    <button onclick="handleReq('${req._id}', 'accept')" class="btn btn-sm btn-success flex-grow-1 py-2 fw-bold">Accept</button>
                    <button onclick="handleReq('${req._id}', 'reject')" class="btn btn-sm btn-outline-danger flex-grow-1 py-2">Reject</button>
                </div>
            </div>`;
        });
    } catch (e) { 
        console.error("Dashboard Load Error:", e);
        activeRideContainer.innerHTML = '<div class="alert alert-danger">Failed to sync with server.</div>';
    }
}
    // 🛠️ The function that the buttons actually call
async function handleReq(id, act) { 
    try {
        const res = await fetch(`/api/requests/${id}/${act}`, { method: 'POST' });
        if (res.ok) {
            showToast("Success", `Request ${act}ed successfully`, "success");
            loadDriverDashboard(); // Refresh the list immediately
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    } catch (e) {
        console.error("Action failed", e);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents immediate closing
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking anywhere on the main content
        document.querySelector('.main-content').addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
});