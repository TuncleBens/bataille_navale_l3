//We need socket.io to enable connection with server
require(['socket.io/socket.io.js']);


var socket = io.connect('localhost:8080');

var salon = false;

toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": true,
  "positionClass": "toast-top-full-width",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
};

//TOATSR : how to use :------------------------
/*
//INFO TOAST
toastr.info("title","message");

// Display a warning toast, with no title
toastr.warning('My name is Inigo Montoya. You killed my father, prepare to die!');

// Display a success toast, with a title
toastr.success('Have fun storming the castle!', 'Miracle Max Says');

// Display an error toast, with a title
toastr.error('I do not think that word means what you think it means.', 'Inconceivable!');

// Immediately remove current toasts without using animation
toastr.remove();

// Remove current toasts using animation
toastr.clear();
*/
//END TOASTR TUTO------------------------------

//OUTILS-------------------------------------

function switch_page(tohide, togo){
    document.getElementById(tohide).style.display = "none";
    document.getElementById(togo).style.display = "block";
    toastr.clear();
}

//MMR-------------------------------------

function annuler_recherche(){
    socket.emit('cancel_search',{sal_state:salon});
    salon = false;
    switch_page("mmr_search","home");
}

function demarrer_mmr(){
    switch_page("home","mmr_search");
    switch_page("attente","rech");
    
    socket.emit("mmr_search");
    
    socket.on('not_found', function(){
        //OUVERTURE D'UN SALON
        salon = true;
        switch_page("rech","attente");
        socket.removeListener("not_found");
    });
    
    socket.on('found', function(){
        switch_page("mmr_search", "ready");
        menu_pret();
        socket.removeListener("not_found");
        socket.removeListener("found");
    });
}

//SALON PRIVE-------------------------------------

function annuler_salon_prive(){
    //PREVENIR LE SERVEUR DE LA FERMETURE DU SALON PRIVE
    socket.emit("cancel_private");
    switch_page("private_room_waiting","home");
}

function demarrer_salon(){
    socket.emit('private_init');
    socket.on('key_code', function(data){
        document.getElementById("key").innerHTML = data["kc"];
        console.log(data.kc);
        switch_page("home","private_room_waiting");
        //ATTENTE DE JOUEUR
        socket.on('found_rival', function(){
            switch_page("private_room_waiting","ready");
            menu_pret();
            socket.removeListener("found_rival");
        });
        socket.removeListener('key_code');
    });
}


//RECHERCHE SALON PRIVE-------------------------------------

function rejoindre_prive(){
    //RECUPERER LES DONNEES DU CHAMPS DE CLE
    socket.emit("private_search", {'sal_key' : document.getElementById("room_key_input").value});
    socket.on("key_response", function(data){
        if(data.found){
            //PARTIE TROUVEE, FAIRE QUELQUE CHOSE
            switch_page("home","ready");
            menu_pret();
        }
        else{
            document.getElementById("room_key_input").value = "";
            toastr.error("Clé invalide !","Impossible de rejoindre une partie avec cette clé");
        }
        socket.removeListener("key_response");
    });
}

//READY-------------------------------------

function menu_pret(){
    socket.on("player_left", function(){
        console.log("other player left the game");
        
        switch_page("ready","home");
        document.getElementById("ready_bt").disabled = false;
        document.getElementById("other_ready_text").innerHTML = "Adversaire pas encore prêt...";
        socket.removeListener("other_cancel");
        socket.removeListener("other_ready");
        socket.removeListener("player_left");
    });
    socket.on("other_ready",function(){
        document.getElementById("other_ready_text").innerHTML = "Adversaire prêt !";
        socket.removeListener("other_ready");
    });
    socket.on("other_cancel",function(){
        document.getElementById("ready_bt").disabled = false;
        document.getElementById("other_ready_text").innerHTML = "Adversaire pas encore prêt...";
        switch_page("ready","home");
        socket.removeListener("other_cancel");
        toastr.info("L'adversaire a quitté la partie...");
    });
}

function annuler_pret(){
    document.getElementById("ready_bt").disabled = false;
    document.getElementById("other_ready_text").innerHTML = "Adversaire pas encore prêt...";
    socket.emit("cancel_ready");
    socket.removeListener("other_ready");
    socket.removeListener("other_cancel");
    socket.removeListener("go_party");
    switch_page("ready","home");
}

function declarer_pret(){
    document.getElementById("ready_bt").disabled = true;
    //AFFICHER QUELQUE CHOSE A L'ECRAN DU JOUEUR
    socket.emit("ready");
    //ATTENDRE LA REPONSE DU SERVEUR, si l'autre est pret, go en jeu
    socket.on("go_party",function(){
        document.getElementById("ready_bt").disabled = false;
        document.getElementById("other_ready_text").innerHTML = "Adversaire pas encore prêt...";
        switch_page("ready","ingame");
        start_game();
        socket.removeListener("go_party");
    });
}

//INGAME-------------------------------------

function hide_boat_placement(){
    document.getElementsByClassName("boats")[0].classList.add("hide_by_default");
    document.getElementById("show_bt").classList.remove("hide_by_default");
}

function show_boat_placement(){
    document.getElementsByClassName("boats")[0].classList.remove("hide_by_default");
    document.getElementById("show_bt").classList.add("hide_by_default");
}

function start_game(){
    createGrid();
    socket.on("player_left", function(){
        quitter_partie();
        socket.removeListener("player_left");
        toastr.info("L'adversaire a quitté la partie...");
    });
    socket.on("boat_placed", function(){
        toastr.info("L'adversaire a placé ses bateaux !");
        socket.removeListener("boat_placed");
    });
}

function quitter_partie(){
    document.getElementById("show_bt").classList.add("hide_by_default");
    socket.emit("quit_game");
    socket.removeListener("player_left");
    socket.removeListener("boat_placed");
    switch_page("ingame","home");
    reset();
}

var taille = 10;
var isdrag = false; //si un element est selectionner pour drag.
var valide = false; //si le bateau peut etre placé a la case.
var ajouer; //si le jouer a jouer.
var elem;
var div;

function createGrid() {
	var gridDivj = document.querySelectorAll('.grid-j');
	var gridDivb = document.querySelectorAll('.grid-b');
	for (var grid = 0; grid < gridDivj.length; grid++) {
		for (var i = 0; i < taille; i++) {
			for (var j = 0; j < taille ; j++) {
                gridj(gridDivj, grid, i, j);
                gridb(gridDivb, grid, i, j);
			}
		}
	}
    rotateimg();
}

function gridj(gridDiv, pos, i, j){
    var el = document.createElement('div');
    el.setAttribute('data-x', i);
    el.setAttribute('data-y', j);
    el.setAttribute('class', 'grid-cell player');

    el.setAttribute('vide', true);
    el.setAttribute('id', i + "" + j);

    el.self = this;
    el.addEventListener('click', eventclic, false);
    el.addEventListener('mouseover', placementMouseover, false);
    el.addEventListener('mouseout', placementMouseout, false);
    gridDiv[pos].appendChild(el);
}

function gridb(gridDiv, pos, i, j){
    var el = document.createElement('div');
    el.setAttribute('data-x', i);
    el.setAttribute('data-y', j);
    el.setAttribute('class', 'grid-cell bot');

    el.setAttribute('vide', true);
    el.setAttribute('id', i + "b" + j);

    el.self = this;
    gridDiv[pos].appendChild(el);
}
function rotateimg() {
	var img = document.querySelectorAll('.boat');
	for (var i = 0; i < img.length; i++) {
        img[i].addEventListener('click', selection, false);
	}
}

function selection(j){
    if (isdrag && (elem.target.getAttribute('id') == j.target.getAttribute('id'))){
        isdrag = false;
        elem = null;
    } else {
        isdrag = true;
        elem = j;
    }
}
                                
function eventclic(j){
    if (isdrag && valide) {
        verouiller(j);
        elem.target.classList.add("hide_by_default"); 
        elem = null;
        isdrag = false;
    }
    if (document.querySelectorAll('.boat').length == 0) {
        iddrag = false;
    }
}

function placementMouseover(j){
    if (isdrag == true) {
        div = j;
        coloriage(j.target, 'black');
    }
}

function placementMouseout(j){
    if (isdrag == true) {
        div = null;
        coloriage(j.target, '#99C2E1')
    }
}

function point(j, x, y) {
   return (document.getElementById('' + (parseInt(Math.floor(j.getAttribute('data-x')) + parseInt(Math.floor(x)))) + '' + (parseInt(Math.floor(j.getAttribute('data-y')) + parseInt(Math.floor(y))))));
}

function listecase(j) {
    var tailleboat = elem.target.getAttribute('taille');
    var liste = [];
    valide = true;
    if (elem.target.getAttribute('pos') == 'h' 
    && ((-1 <= j.getAttribute('data-y')-tailleboat/2)
    && (j.getAttribute('data-y') < taille) 
    && (-1 < (parseInt(j.getAttribute('data-y'))+tailleboat/2))
    && (parseInt(j.getAttribute('data-y'))+tailleboat/2) < taille)) {
        for (var i = 0; i < tailleboat; i++) {
            liste[i] = point(j, 0, tailleboat/2 - i);
        }
    } else if (elem.target.getAttribute('pos') == 'v'
              && ((-1 <= j.getAttribute('data-x')-tailleboat/2)
    && (j.getAttribute('data-x') < taille) 
    && (-1 < (parseInt(j.getAttribute('data-x'))+tailleboat/2))
    && (parseInt(j.getAttribute('data-x'))+tailleboat/2) < taille)) {
        for (var i = 0; i < tailleboat; i++) {
            liste[i] = point(j, tailleboat/2 - i, 0);
        }
    }
    if (liste.length==0) {
        valide = false;
    }
    return liste;
}

function coloriage(j, couleur) {
    if (elem == null) {
        j.style.backgroundColor = couleur;
    } else {
        var liste = listecase(j);
        if (estVerouiller(liste) == false) {
            for (var i = 0; i < liste.length; i++) {
                liste[i].style.backgroundColor = couleur;
            }
        }
    }
}

function estVerouiller(liste){
    var res = false;
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].getAttribute('vide') != 'true'){
            res = true;
        }
    }
    return res;
}

function verouiller(j) {
    var liste = listecase(j.target);
    for (var i = 0; i < liste.length; i++) {
        coloriage(j.target, 'green');
        liste[i].setAttribute('vide', false);
        liste[i].setAttribute('boat', elem.target.getAttribute('id'));
    }
}

document.onkeydown = function (e) {
    e=e || window.event;
    var code=e.keyCode || e.wihch;
    if (code == 82 && isdrag == true && div != null) {
        coloriage(div.target, '#99C2E1');
        if (elem.target.getAttribute('pos') == "h"){
            elem.target.setAttribute('pos', 'v');
        } else {
            elem.target.setAttribute('pos', 'h');
        }
        coloriage(div.target, 'black');
    }
}



function jouer(){
    var bool = true;
    var img = document.getElementsByClassName("boat");
    for (var el = 0; el < img.length; el++) {
        if (!img[el].classList.contains("hide_by_default")) {
            bool = false;
        }
    }
    if(bool == false) {
        toastr.error("Vous n'avez pas placé tous vos bateaux...");
    } else {
        supprimg();
        socket.on("jouer", function() {
            debutaction();
        });
        socket.on("attendre", function() {
            debutattente();
        })
        socket.emit("boat_placed");
    }
}

function debutaction() {
    ajouer = false;
    console.log("c'est mon tour");
    initlistener();
}

function debutattente() {
    removelistener();
    console.log("ce n'est pas mon tour");
    socket.on("player_attack", function(data) {
        socket.emit("result_attack", isVide(data));
        socket.removeListener("player_attack");
        debutaction();
    });
}

function isVide(j) {
    return document.getElementById(j).getAttribute("vide");
}

function fire(j){
    var pos = "" + j.target.getAttribute("data-x") + j.target.getAttribute("data-y");
    socket.emit("player_attack", pos);
    socket.on("result_attack", function(data) {
        if (data == "true") {
            coloriage(j.target, 'purple');
        } else {
            coloriage(j.target, 'yellow');
        }
        socket.removeListener("result_attack");
        debutattente();
    });
}

function initlistener() {
    var gridDiv = document.querySelectorAll('.bot');
	for (var grid = 0; grid < gridDiv.length; grid++) {
        gridDiv[grid].setAttribute('vide', true);
        gridDiv[grid].addEventListener('click', fire, false);
	}
}

function removelistener() {
    var gridDiv = document.querySelectorAll('.bot');
	for (var grid = 0; grid < gridDiv.length; grid++) {
        gridDiv[grid].removeEventListener('click', fire, false);
	}
}

function supprimg() {
    document.getElementById("show_bt").classList.add("hide_by_default");
    document.querySelector('.boats').classList.add("hide_by_default");
    elem = null;
    var gridDiv = document.querySelectorAll('.player');
	for (var grid = 0; grid < gridDiv.length; grid++) {
        gridDiv[grid].removeEventListener('click', eventclic, false);
        gridDiv[grid].removeEventListener('mouseover', placementMouseover, false);
        gridDiv[grid].removeEventListener('mouseout', placementMouseout, false);
//        gridDiv[grid].setAttribute('vide', true);
	}
}

function reset() {
    var gridDiv = document.querySelectorAll('.grid-cell');
    for (var grid = 0; grid < gridDiv.length; grid++) {
        gridDiv[grid].remove();
    }
    document.getElementsByClassName("boats")[0].classList.remove("hide_by_default");
    var img = document.getElementsByClassName("boat");
    for (var el = 0; el < img.length; el++) {
        img[el].classList.remove("hide_by_default");
    }
}