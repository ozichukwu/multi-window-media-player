function getPosition(){
    return {
        _: Math.random(), //ensures localStorage is modified to trigger the storage event
        id: windowId,
        x: window.screenX || window.screenLeft,
        y: window.screenY || window.screenTop,
        w: window.innerWidth,
        h: window.innerHeight
    };
}

function broadcastWindowPosition(){
    localStorage.setItem("posUpdate", JSON.stringify(getPosition()));
}


function requestPositionUpdates(){
    localStorage.setItem("allPosUpdates", !JSON.parse(localStorage.getItem("allPosUpdates") ?? 0));
}


function processWindowPositionChange(){

    function calcVideoDimensions() {
        //Calculates video width, factoring cases of overlapping and separate windows

        const dimensions = [];
        const widths = [...positions].map(p => [p.x, p.x + p.w]).sort((x, y) => x[0] - y[0]);
        const heights = [...positions].map(p => [p.y, p.y + p.h]).sort((x, y) => x[0] - y[0]);

        for (const dists of [widths, heights]) {
            const newDists = [dists[0]];
            for (let i = 1; i < dists.length; i++) {

                if (dists[i][0] > newDists[newDists.length - 1][1])
                    newDists.push(dists[i]);

                else if (dists[i][1] > newDists[newDists.length - 1][1])
                    newDists[newDists.length - 1][1] = dists[i][1];
            }
            dimensions.push(newDists.reduce((a, v) => a + v[1] - v[0], 0));
        }
        return dimensions;
    }

    function calcVideoOffset() {
        //Calculates offset of the video, given the xLow, yLow, xHigh, yHigh coords

        const offset = [];
        const tabPos = [windowsPosition[windowId].x, windowsPosition[windowId].y];
        const widths = [...positions].map(p => [p.x, p.x + p.w]).sort((x, y) => x[0] - y[0]);
        const heights = [...positions].map(p => [p.y, p.y + p.h]).sort((x, y) => x[0] - y[0]);

        for (const [pos, dists] of [[tabPos[0], widths], [tabPos[1], heights]]) {
            let totalDist = 0;

            for (let i = 0; i < dists.length; i++) {
                if (pos === dists[i][0]) {
                    if (totalDist === 0)
                        offset.push(0);

                    else if (pos <= dists[i - 1][1])
                        offset.push(totalDist - (dists[i - 1][1] - pos));
                    
                    else offset.push(totalDist + 1);

                    break;
                }

                totalDist += dists[i][1] - dists[i][0];
                
                if (i > 0 && dists[i][0] <= dists[i - 1][1])
                    totalDist -= (dists[i - 1][1] - dists[i][0]);
            }
        }
        return offset;
    }

    const positions = Object.values(windowsPosition);

    let [xLow, yLow] = [Infinity, Infinity];

    for (const pos of positions) {
        xLow = Math.min(xLow, pos.x);
        yLow = Math.min(yLow, pos.y);
    }

    const [totalWidth, totalHeight] = calcVideoDimensions();

    const [offsetX, offsetY] = calcVideoOffset();

    //apply offsets
    document.documentElement.style.setProperty("--video-width", `${totalWidth}px`);
    document.documentElement.style.setProperty("--video-height", `${totalHeight}px`);
    document.documentElement.style.setProperty("--translateX", `-${offsetX}px`);
    document.documentElement.style.setProperty("--translateY", `-${offsetY}px`);
}


function assignWindowId() {
    windowId = JSON.parse(localStorage.getItem("windows") ?? -1) + 1;
    localStorage.setItem("windows", JSON.stringify(windowId));
}


function playVideo() {
    const video = document.getElementById("video");
    const mediaDevices = navigator.mediaDevices;

    video.muted = true;

    mediaDevices
        .getUserMedia({video: true, audio: true})
        .then((stream) => {
            // Changing the source of video to current stream.
            video.srcObject = stream;
            video.addEventListener("loadedmetadata", () => {
                video.play();
            });
        })
        .catch(alert);
}


let windowId;
assignWindowId();
playVideo();

windowsPosition = {};
windowsPosition[windowId] = getPosition();

broadcastWindowPosition();

//listen for updates on localStorage
window.addEventListener("storage", function(event) {
    const key = event.key;
    const value = JSON.parse(event.newValue);

    if (key === "posUpdate") {
        windowsPosition[value.id] = value;
        processWindowPositionChange();
    }

    else if (key === "allPosUpdates") {
        broadcastWindowPosition();
    }

    else if (key === "terminateWindow") {
        delete windowsPosition[value.id];
        processWindowPositionChange();
    }
});

requestPositionUpdates();

//poll for change in window position
setInterval(function(){
    
    const currentPos = windowsPosition[windowId];
    const newPos = getPosition();
    if ([..."xywh"].some(key => currentPos[key] !== newPos[key])) {
        windowsPosition[windowId] = getPosition();
        processWindowPositionChange();
        broadcastWindowPosition();
    }

}, 100);


//detect when a tab is about to close and notify others
window.addEventListener("beforeunload", function() {
    localStorage.setItem("terminateWindow", JSON.stringify({
        id: windowId
    }));
});