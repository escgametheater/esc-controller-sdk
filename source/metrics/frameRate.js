

let metrics = {
    lastFrameTimeStamp : 0 ,
    lastFrameTimeDelta : 0 ,
    minTimeDelta : Number.MAX_VALUE ,
    frameCount: 0,
    warnDelta: 34 , // Warn if the delta is more than this ms
};

const FrameRateWatcher = (timeStamp) => {
    metrics.frameCount ++ ;
    if (metrics.lastFrameTimeStamp) {
        metrics.lastFrameTimeDelta = timeStamp - metrics.lastFrameTimeStamp ;
        if (metrics.lastFrameTimeDelta > metrics.warnDelta) {
            //console.warn("Frame delay high: "+metrics.lastFrameTimeDelta.toFixed(1));
        }
        metrics.minTimeDelta = Math.min(metrics.minTimeDelta,metrics.lastFrameTimeDelta);
        metrics.warnDelta = Math.max(34,metrics.minTimeDelta + 1) ;
    }
    metrics.lastFrameTimeStamp = timeStamp ;
    requestAnimationFrame(FrameRateWatcher);
};

requestAnimationFrame(FrameRateWatcher);

export {
    metrics as frameRateMetrics,
};
