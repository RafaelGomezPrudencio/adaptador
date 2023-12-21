const readline = require('readline');
const os = require('os');
const OPERATING_SYSTEM = os.platform();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Estados
const ESTADOS = {
  IP: 'IP',
  NETMASK: 'NETMASK',
  GATEWAY: 'GATEWAY',
  ADD_GATEWAY: 'ADD_GATEWAY',
  ADAPTER: 'ADAPTER',
  CONFIRMATION: 'CONFIRMATION',
  FINISHED: 'FINISHED'
};

let estado = ESTADOS.IP;
let ip, netmask, gateway, selectedAdapter;

let adaptadoresWin = ["LOW1", "LOW2", "LOW3", "PLO-WIN7", "PLO"];
let adaptadoresLin = ["eno16780032"];
let rutaDaptadorLin= "/etc/sysconfig/network-scripts/" ///     etc/sysconfig/network-scripts/

let adaptadores = OPERATING_SYSTEM == 'win32' ? adaptadoresWin : adaptadoresLin;

let aplicarCambiosWindows = (adapter, ip, netmask, gateway) => {
  const command = `netsh interface ip set address "${adapter}" static ${ip} ${netmask} ${gateway}`;
  exec(command, (error, stdout, stderr) => {
    console.log(`\n${stdout}`);
    if (stderr) {
      console.error(`\n${stderr}`);
    } else{
      console.log(`\n Cambios aplicados correctamente`);
    }
    estado=ESTADOS.FINISHED
    askQuestion();
  });
}

let aplicarCambiosLinux = (adapter,ip, netmask, gateway) => {
  const commandSetDown = `sudo Ifdown ifcfg-eno16780032`;
  const commandSetUp = `sudo Ifup ifcfg-eno16780032`;
    // Leer el archivo de configuración
    fs.promises.readFile(rutaDaptadorLin+adapter, 'utf8').then(config =>{
      // Dividir el contenido en líneas y procesar cada una
      let lines = config.split('\n');
      for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
  
          // Separar la línea en clave y valor
          let parts = line.split('=');
          if (parts.length === 2) {
              let key = parts[0].trim();
              let value = parts[1].trim();
  
              // Si la clave existe en los cambios, actualizar el valor
              switch (key) {
                  case 'IPADDR':
                      value = ip;
                      break;
                  case 'NETMASK':
                      value = netmask;
                      break;
                  case 'GATEWAY':
                      value = gateway;
                      break;
              }
              lines[i] = `${key}=${value}`;
          }
      }
  
      // Reensamblar el archivo de configuración
      let updatedConfig = lines.join('\n');
  
      // Escribir los cambios en el archivo
      fs.promises.writeFile(rutaDaptadorLin+adapter, updatedConfig, 'utf8').then(() => {
          console.log(`Archivo de configuración ${rutaDaptadorLin+adapter} modificado.`);
          exec(commandSetDown, (error, stdout, stderr) => {
            console.log(`\n${stdout}`);
            if (stderr) {
              console.error(`\n${stderr}`);
              estado=ESTADOS.FINISHED
              askQuestion();
            }else{
              exec(commandSetUp, (error, stdout, stderr) => {
                if (stderr) {
                  console.error(`\n${stderr}`);
                }
                console.log(`\n${stdout}`);
                estado=ESTADOS.FINISHED
                askQuestion();
              });
            }
          });
      }).catch(error => {
          console.error(`Error al escribir el archivo de configuración ${rutaDaptadorLin+adapter}:`, error);
          estado=ESTADOS.FINISHED
          askQuestion();
      });
    })
    .catch(error => {
      console.error(`Error al leer el archivo de configuración ${rutaDaptadorLin+adapter}:`, error);
      estado=ESTADOS.FINISHED
      askQuestion();
    }); 
}

let aplicarCambios = OPERATING_SYSTEM == 'win32' ? aplicarCambiosWindows : aplicarCambiosLinux;


// Función para validar la dirección IP
function isValidIP(ip) {
  const regEx = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return regEx.test(ip);
}

// Función para validar la máscara de red
function isValidNetmask(mask) {
  const regEx = /^(255|254|252|248|240|224|192|128|0)\.(255|254|252|248|240|224|192|128|0)\.(255|254|252|248|240|224|192|128|0)\.(255|254|252|248|240|224|192|128|0)$/;
  return regEx.test(mask);
}



// Función para obtener y mostrar los adaptadores de red
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  return Object.keys(interfaces).filter(adapter => { return adaptadores.includes(adapter)});
}

function asignarGateway(ipOriginal, netmask) {
  const ipOctets = ipOriginal.split('.').map(Number);
  const maskOctets = netmask.split('.').map(Number);

  // Calcular la dirección de red realizando un AND entre IP y máscara de red
  const networkAddress = ipOctets.map((octet, index) => octet & maskOctets[index]);

  // Incrementar el último octeto para obtener el gateway
  networkAddress[3] = (networkAddress[3] + 1) % 256;

  return networkAddress.join('.');
}

function askQuestion() {
  switch (estado) {
    case ESTADOS.IP:
      rl.question('Ingrese la dirección IP: ', input => {
        if (isValidIP(input)) {
          ip = input;
          estado = ESTADOS.NETMASK;
        } else {
          console.log('Dirección IP inválida.');
        }
        askQuestion();
      });
      break;

    case ESTADOS.NETMASK:
      rl.question('\nIngrese la máscara de red: ', input => {
        if (isValidNetmask(input)) {
          netmask = input;
          estado = ESTADOS.GATEWAY;
        } else {
          console.log('Máscara de red inválida.');
        }
        askQuestion();
      });
      break;

    case ESTADOS.GATEWAY:
      rl.question('\n¿Desea añadir un gateway manualmente? (Y/N): ', input => {
          if (input.toLowerCase() === 'y') {
            estado = ESTADOS.ADD_GATEWAY;
          } else if (input.toLowerCase() === 'n') {
            gateway = asignarGateway(ip, netmask) ;
            estado = ESTADOS.ADAPTER;
          } else {
            console.log('Selección inválida.');
          }
          askQuestion();
      });
      break;

      case ESTADOS.ADD_GATEWAY:
        rl.question('\nIngrese el gateway: ', input => {
          if (isValidIP(input)) {
            gateway = input;
            estado = ESTADOS.ADAPTER;
          } else {
            console.log('gateway inválido.');
          }          
          askQuestion();
        });
        break;

    case ESTADOS.ADAPTER:
      const adapters = getNetworkInterfaces();
      console.log('\nElija un adaptador de la siguiente lista: ');
      adapters.forEach((adapter, index) => {
        console.log(`${index + 1}. ${adapter}`);
      });
      rl.question('\nSeleccione el número del adaptador: ', input => {
        const adapterIndex = parseInt(input, 10) - 1;
        if (adapterIndex >= 0 && adapterIndex < adapters.length) {
          selectedAdapter = adapters[adapterIndex];
          estado = ESTADOS.CONFIRMATION;
        } else {
          console.log('Selección inválida.');
        }
        askQuestion();
      });
      break;

    case ESTADOS.CONFIRMATION:      
      console.log(`\nIP: ${ip}, \nMáscara: ${netmask}, \ngateway: ${gateway}, \nAdaptador: ${selectedAdapter}`);
      rl.question('\n¿Desea continuar? (Y/N): ', input => {
        if (input.toLowerCase() === 'y') {
          aplicarCambios(selectedAdapter, ip, netmask, gateway );
        } else if (input.toLowerCase() === 'n') {
          estado = ESTADOS.IP;
          askQuestion();
        } else {
          console.log('Selección inválida.');
          askQuestion();
        }
      });
      break;

      
    case ESTADOS.FINISHED:
      rl.question('\nCerrando... pulse enter para continuar', input => {
        rl.close();
      });
      break;
  }
}

askQuestion();
