const nextButton = document.getElementById("next");
const backButton = document.getElementById("back");
const subSelect = document.getElementById("sub");
const img = document.getElementById("img");
const loading = document.getElementById("loading");

const {
    Observable,
    Subject,
    ReplaySubject,
    from,
    of,
    range,
    fromEvent,
    merge,
    concat,
    fromPromise,
    defer,
} = rxjs;
const {
    map,
    filter,
    switchMap,
    mergeAll,
    scan,
    tap,
    startWith
} = rxjs.operators;

const LOADING_ERROR_URL = "https://jhusain.github.io/reddit-image-viewer/error.png";



// function which returns an array of image URLs for a given reddit sub
// getSubImages("pics") ->
// [
//   "https://upload.wikimedia.org/wikipedia/commons/3/36/Hopetoun_falls.jpg",
//   "https://upload.wikimedia.org/wikipedia/commons/3/38/4-Nature-Wallpapers-2014-1_ukaavUI.jpg",
//   ...
// ]
function getSubImages(sub) {
    const cachedImages = localStorage.getItem(sub);
    if (cachedImages) {
        return of(JSON.parse(cachedImages));
    }
    else {
        const url = `https://www.reddit.com/r/${sub}/.json?limit=200&show=all`;

        // defer ensure new Observable (and therefore) promise gets created
        // for each subscription. This ensures functions like retry will
        // issue additional requests.
        return defer(() =>
            from(
                fetch(url).then(res => res.json()).then(data => {
                    const images =
                        data.data.children.
                            map(image => image.data.url);
                    localStorage.setItem(sub, JSON.stringify(images));
                    return images;
                })));
    }
}

// ---------------------- INSERT CODE  HERE ---------------------------

const subs =
    concat(
        of(subSelect.value),
        fromEvent(subSelect, 'change').
            pipe(
                map(ev => ev.target.value))
    );

const nexts =
    fromEvent(nextButton, 'click');

const backs =
    fromEvent(backButton, 'click');

const offsets =
    merge(
        nexts.pipe(
            map(() => 1)
        ),
        backs.pipe(
            map(() => -1)
        ),
    );

const indices =

    offsets.pipe(
        // The scan operator does not emit the initial
        // value, startWith will add initial value to stream
        // startWith(0),
        startWith(0),

        // wrap around here
        scan((acc, curr) => acc + curr, 0)
    );

const images =
    subs.pipe(
        switchMap(sub =>
            getSubImages(sub).pipe(
                switchMap(images =>
                    indices.pipe(
                        filter(index => index >= 0 && index < images.length),
                        map(index => images[index])
                    )
                ),
                switchMap(url => preloadImage(url))
            )
        ),
    );

function preloadImage(src) {
    // using create
    // return Observable.create((observer) => {
    //     const img = new Image();
    //
    //     img.onload = () => {
    //       observer.next(src);
    //       observer.complete();
    //     };
    //
    //     img.onerror = () => {
    //         observer.next(LOADING_ERROR_URL);
    //         observer.complete();
    //     };
    //
    //     img.src = src;
    //
    //     // unsubscribe
    //     return () => {
    //         delete img.onerror;
    //         delete img.onload;
    //     }
    // });

    // using fromEvent
    return defer(() => {
        const img = new Image();
        const success = fromEvent(img, 'load')
            .pipe(
                map(() => src)
            );
        const failure = fromEvent(img, 'error')
            .pipe(
                map(() => LOADING_ERROR_URL)
            );

        img.src = src;

        return merge(success, failure);
    });
}


// This "actions" Observable is a placeholder. Replace it with an
// observable that notfies whenever a user performs an action,
// like changing the sub or navigating the images
const actions = merge(subs, nexts, backs);

actions.subscribe(() => loading.style.visibility = "visible");

images.subscribe({
    next(url) {
        // hide the loading image
        loading.style.visibility = "hidden";

        // set Image source to URL
        img.src = url;
    },
    error(e) {
        alert("I'm having trouble loading the images for that sub. Please wait a while, reload, and then try again later.")
    }
});

