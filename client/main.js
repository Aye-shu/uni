/* ==========================================================
   UNIBUS MAIN JAVASCRIPT
========================================================== */

document.addEventListener("DOMContentLoaded", function () {

    /* ======================================================
       MOBILE NAVIGATION
    ====================================================== */

    const mobileMenu =
        document.getElementById("mobileMenu");

    const navbar =
        document.getElementById("navbar");


    if (mobileMenu && navbar) {

        mobileMenu.addEventListener("click", function () {

            navbar.classList.toggle("mobile-open");

        });


        navbar.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {

                navbar.classList.remove("mobile-open");

            });

        });

    }



    /* ======================================================
       SET TODAY AS MINIMUM DATE
    ====================================================== */

    const travelDate =
        document.getElementById("travelDate");


    if (travelDate) {

        const today =
            new Date();


        const year =
            today.getFullYear();


        const month =
            String(
                today.getMonth() + 1
            ).padStart(2, "0");


        const day =
            String(
                today.getDate()
            ).padStart(2, "0");


        const formattedDate =
            `${year}-${month}-${day}`;


        travelDate.min =
            formattedDate;


        travelDate.value =
            formattedDate;

    }



    /* ======================================================
       BUS SEARCH — redirect to login or find-bus page
    ====================================================== */

    const searchForm =
        document.getElementById(
            "busSearchForm"
        );


    const formMessage =
        document.getElementById(
            "formMessage"
        );


    if (searchForm) {

        searchForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const pickup =
                    document.getElementById(
                        "pickup"
                    ).value;


                const destination =
                    document.getElementById(
                        "destination"
                    ).value;


                const date =
                    document.getElementById(
                        "travelDate"
                    ).value;


                const classTime =
                    document.getElementById(
                        "classTime"
                    ).value;


                const tripType =
                    document.querySelector(
                        'input[name="tripType"]:checked'
                    );


                if (
                    !pickup ||
                    !destination ||
                    !date ||
                    !classTime
                ) {

                    formMessage.textContent =
                        "Please complete all fields.";

                    formMessage.style.color =
                        "#d9534f";

                    return;

                }


                const direction =
                    tripType &&
                    tripType.value === "return"
                        ? "return"
                        : "outbound";


                formMessage.textContent =
                    "Searching...";

                formMessage.style.color =
                    "#1769ff";


                /* ------------------------------------------
                   Check if user is logged in
                ------------------------------------------ */

                let loggedIn = false;
                let userRole = null;

                try {

                    const res = await fetch(
                        "/api/auth/get-session",
                        { credentials: "include" }
                    );

                    const data = await res.json();

                    loggedIn = !!data?.user;

                    userRole = data?.user?.role || null;

                } catch (err) {

                    loggedIn = false;

                }


                /* ------------------------------------------
                   Not logged in → redirect to login
                ------------------------------------------ */

                if (!loggedIn) {

                    formMessage.textContent =
                        "Redirecting to login...";

                    setTimeout(function () {

                        window.location.href =
                            "/login.html";

                    }, 500);

                    return;

                }


                /* ------------------------------------------
                   Logged in as student → go to find-bus
                   with filters pre-applied
                ------------------------------------------ */

                if (userRole === "student") {

                    const params =
                        new URLSearchParams({
                            pickup,
                            destination,
                            date,
                            direction,
                        });


                    window.location.href =
                        `/student/find-bus.html?${params.toString()}`;

                    return;

                }


                /* ------------------------------------------
                   Logged in as driver/admin → send to their dashboard
                ------------------------------------------ */

                if (userRole === "driver") {

                    window.location.href =
                        "/driver/dashboard.html";

                    return;

                }

                if (userRole === "admin") {

                    window.location.href =
                        "/admin/dashboard.html";

                    return;

                }


                /* Fallback */

                window.location.href =
                    "/login.html";

            }
        );

    }



    /* ======================================================
       SIMPLE SCROLL ANIMATION
    ====================================================== */

    const observer =
        new IntersectionObserver(
            function (entries) {

                entries.forEach(function (entry) {

                    if (entry.isIntersecting) {

                        entry.target.classList.add(
                            "visible"
                        );

                    }

                });

            },

            {
                threshold: 0.12
            }

        );


    document
        .querySelectorAll(
            ".service-card, .bus-card, .workflow-card, .testimonial"
        )
        .forEach(function (element) {

            observer.observe(element);

        });

});