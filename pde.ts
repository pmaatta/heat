
function initializeHeatGrid(rows: number, cols: number, method: "zeros" | "exp", beta=0.0001, alpha=255): number[][] {
    
    if (rows <= 0 || rows > 1080 || cols <= 0 || cols > 1920) {
        throw "Invalid row or column count!";
    }
    
    const heatGrid: number[][] = [];

    // Initialize with zeros
    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
            row.push(0);
        }
        heatGrid.push(row);
    }

    // Initialize with radial basis function
    if (method === "exp") {
        const midX = Math.floor(cols / 2);
        const midY = Math.floor(rows / 2);
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const sqDist = (i-midY)**2 + (j-midX)**2;
                heatGrid[i][j] = alpha * Math.exp(-beta * sqDist);
            }
        }
    }

    return heatGrid;
}

function heatDissipationTimeStep(heatGrid: number[][], gamma: number): void {
    
    //  Temperature update based on heat equation (finite difference method) 

    const rows = heatGrid.length;
    const cols = heatGrid[0].length;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {

            const a = i - 1 >= 0    ? heatGrid[i-1][j] : 0;
            const b = i + 1 <  rows ? heatGrid[i+1][j] : 0;
            const c = j - 1 >= 0    ? heatGrid[i][j-1] : 0;
            const d = j + 1 <  cols ? heatGrid[i][j+1] : 0;
            const e = heatGrid[i][j];

            let temp = gamma*(a + b + c + d + 4*e) - e;
            temp = temp >= 0 ? temp : 0;
            heatGrid[i][j] = temp;
        }
    }
}

function drawHeatGrid(canvas: HTMLCanvasElement, 
                      ctx: CanvasRenderingContext2D,
                      imageData: ImageData,
                      heatGrid: number[][], 
                      scale: number = 1): void {

    // Cols <-> X <-> width
    // Rows <-> Y <-> height
    // scale = ratio between canvas pixels and heat grid 'pixels'

    const canvasSizeX = canvas.width; 
    const canvasSizeY = canvas.height; 
    const gridSizeX = heatGrid[0].length;
    const gridSizeY = heatGrid.length;

    if (gridSizeX > canvasSizeX || gridSizeY > canvasSizeY) {
        alert("Grid is larger than canvas");
        throw "Grid is larger than canvas";
    }

    const fullCellsX = Math.floor(canvasSizeX / scale);
    const fullCellsY = Math.floor(canvasSizeY / scale);
    const remainderX = canvasSizeX % scale;
    const remainderY = canvasSizeY % scale;
    const totalCellsX = remainderX === 0 ? fullCellsX : fullCellsX + 1;
    const totalCellsY = remainderY === 0 ? fullCellsY : fullCellsY + 1;

    if (totalCellsX !== gridSizeX || totalCellsY !== gridSizeY) {
        console.log({scale});
        alert("Mismatch in canvas and grid sizes");
        throw "Mismatch in canvas and grid sizes";
    }

    // Full cells
    for (let row = 0; row < fullCellsY; row++) {
        for (let col = 0; col < fullCellsX; col++) {
            for (let y = row*scale; y < (row+1)*scale; y++) {
                for (let x = col*scale; x < (col+1)*scale; x++) {
                    const redIndex = y*canvasSizeX*4 + x*4;
                    const heat = heatGrid[row][col];
                    imageData.data[redIndex] = heat;
                    imageData.data[redIndex+1] = 0.2*heat;
                    imageData.data[redIndex+2] = 15;
                    imageData.data[redIndex+3] = 255;
                }
            }
        }
    }
    
    // Remainder
    for (let row = fullCellsY*scale; row < gridSizeY; row++) {
        for (let col = fullCellsX*scale; col < gridSizeX; col++) {
            for (let y = row*scale; y < canvasSizeY; y++) {
                for (let x = col*scale; x < canvasSizeX; x++) {
                    const redIndex = y*canvasSizeX*4 + x*4;
                    const heat = heatGrid[row][col];
                    imageData.data[redIndex] = heat;
                    imageData.data[redIndex+1] = 0.2*heat;
                    imageData.data[redIndex+2] = 15;
                    imageData.data[redIndex+3] = 255;
                }
            }
        }
    }

    // Draw stored pixels
    ctx.putImageData(imageData, 0, 0);
}

function onDocumentReady(callback) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(callback, 1);
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }
}

function getMousePosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return [x, y];
}

function canvasXYToGridXY(canvasX: number, canvasY: number, scale: number): number[] {
    const gridX = Math.floor((canvasX-1) / scale);
    const gridY = Math.floor((canvasY-1) / scale);
    return [gridX, gridY];
}


// ========================== Main ========================== //

onDocumentReady(() => {

    // --- HTML Elements --- //

    const canvas: HTMLCanvasElement = document.querySelector("canvas");
    const ctx: CanvasRenderingContext2D = canvas.getContext("2d");

    const gammaInput = <HTMLInputElement>document.getElementById("gamma");
    const scaleInput = <HTMLInputElement>document.getElementById("scale");
    const heatMultiplierInput = <HTMLInputElement>document.getElementById("heatmultiplier");
    const betaInput = <HTMLInputElement>document.getElementById("beta");
    const resetButton = document.getElementById("reset");


    // --- Parameters & initialization --- //

    // Ratio between canvas pixels and heat grid 'pixels'
    const scaleInputToScale = {1: 10, 2: 8, 3: 5, 4: 4, 5: 2, 6: 1};
    let scale = scaleInputToScale[parseInt(scaleInput.value, 10)];

    // Heat dissipation strength parameter
    let gamma = parseFloat(gammaInput.value);

    // Multiplier for heat added on mouse click
    let heatMultiplier = parseFloat(heatMultiplierInput.value);

    // Parameter that controls the spread of the initial gaussian distribution
    let beta = parseInt(betaInput.value, 10);
    let betaScaled = (beta/100000) * scale**2;

    // 2D grid of temperature values
    let rows = Math.floor(canvas.height/scale);
    let cols = Math.floor(canvas.width/scale);
    let heatGrid: number[][] = initializeHeatGrid(rows, cols, "exp", betaScaled);

    // Canvas image data for raw pixel manipulation
    let imageData: ImageData = ctx.createImageData(canvas.width, canvas.height);

    // Add heat when holding mouse down on canvas
    const addedHeatOnMouseClick = 8;
    const mouseEventDelayMilliseconds = 10;

    // Start animation
    const frameDelayMilliseconds = 30;
    let timeOutID: number;
    animate();


    // --- Controls --- //

    function animate(): void {
        drawHeatGrid(canvas, ctx, imageData, heatGrid, scale);
        heatDissipationTimeStep(heatGrid, gamma);
        timeOutID = setTimeout(animate, frameDelayMilliseconds);
    }

    resetButton.addEventListener("click", function() {
        // Get parameters
        gamma = parseFloat(gammaInput.value);
        scale = scaleInputToScale[parseInt(scaleInput.value, 10)];
        beta = parseInt(betaInput.value, 10);
        betaScaled = (beta/100000) * scale**2;

        // Reset heat grid & animate
        rows = Math.floor(canvas.height/scale);
        cols = Math.floor(canvas.width/scale);
        heatGrid = initializeHeatGrid(rows, cols, "exp", betaScaled);
        imageData = ctx.createImageData(canvas.width, canvas.height);
        if (typeof timeOutID !== "undefined") clearTimeout(timeOutID);
        animate();
    });

    gammaInput.addEventListener("change", function() {
        gamma = parseFloat(gammaInput.value);
    });

    heatMultiplierInput.addEventListener("change", function() {
        heatMultiplier = parseFloat(heatMultiplierInput.value);
    });
    
    (function setupAddHeatOnMouseClick(): void {

        let mouseEvent: MouseEvent;
        let holding = false;
        let intervalID: number;
    
        function interval(): void {
            intervalID = setInterval(function() {
                if (!holding) {
                    clearInterval(intervalID);
                } 
                else {
    
                    // Get mouse position and add heat at that point
                    const [x, y] = getMousePosition(canvas, mouseEvent);
                    const [gridX, gridY] = canvasXYToGridXY(x, y, scale);
                    let heat = heatMultiplier * addedHeatOnMouseClick;
                    
                    if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
                        
                        // Mouse position
                        heatGrid[gridY][gridX] += heat;
                        
                        // Neighboring pixels
                        if (gridX > 0) {
                            heatGrid[gridY][gridX - 1] += heat;
                        }
                        if (gridX < cols - 1) {
                            heatGrid[gridY][gridX + 1] += heat;
                        }
                        if (gridY > 0) {
                            heatGrid[gridY - 1][gridX] += heat;
                        }
                        if (gridY < rows - 1) {
                            heatGrid[gridY + 1][gridX] += heat;
                        }
                    }
                }
            }, mouseEventDelayMilliseconds);
        }
        canvas.addEventListener('mousedown', function() {
            holding = true;
            interval();
        });
        canvas.addEventListener('mouseup', function() {
            holding = false;
            interval();
        });
        canvas.addEventListener('mouseleave', function() {
            holding = false;
            interval();
        });
        canvas.addEventListener('mousemove', function(event) {
            mouseEvent = event;
        });

    })();

});
