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
       BUS SEARCH DEMO
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
            function (event) {

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

                        ? "University → Home"

                        : `${pickup} → ${destination}`;


                formMessage.textContent =
                    `Demo: Finding the best ${direction} bus around your ${classTime} class.`;


                formMessage.style.color =
                    "#1769ff";


                /*
                    LATER:

                    This section will call your
                    Node.js + Express backend.

                    Example:

                    fetch("/api/trips/search", {
                        method: "POST",
                        body: JSON.stringify(...)
                    });

                */

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