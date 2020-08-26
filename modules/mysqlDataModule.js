const passwordHash = require('password-hash')

const mySql = require('mysql')
const fs = require('fs')

const { resolve } = require('path')
//const connectionString = 'mongodb+srv://project_drHouse:iq3B2TqA4lro2dGJ@cluster0.sagxs.mongodb.net/drHouse?retryWrites=true&w=majority'

const emailSender = require('./emailSender')

let con = null

function connect() {
    return new Promise ((resolve, reject) => {
        if (con) {
            if (con.state === 'disconnected') {
                con.connect(error => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            } else {
                con = mySql.createConnection({
                    multipleStatements: true,
                    host: 'localhost',
                    port: '***',
                    user: '***',
                    password: '***',
                    database: 'dr.House'
                })
                con.connect(error => {
                    if(error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            }
        }
    })
}

function runQuery(queryString) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            con.query(queryString, (error, result, fields) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            }).catch(error => {
                reject(error)
            })
        })
    })
}

function registerUser(email, password) {
    return new Promise((resolve, reject) => {
        runQuery(`INSERT INTO users (email, password) Values ('${email}', '${passwordHash.generate(password)}')`).then(() => {
            resolve()
        }).catch(error => {
            if (error.errno === 1062) {
                reject('exist')
            } else {
                reject(error)
            }
        })
    })
}

function checkUser(email, password) {
    return new Promise((resolve, reject) => {
        runQuery(`SELECT * FROM users where email like '${email}'`).then(result => {
            console.log(result)
            if (result.length === 0) {
                reject(3)
            } else {
                if (passwordHash.verify(password, result[0].password)) {
                    result[0]._id = result[0].id
                    resolve(result[0])
                } else {
                    reject(3)
                }
            }
        }).catch(error => {
            reject(error)
        })
    })
}

function addPatient(patientTitle, patientDescription, patientPdf, patientImgs, userid) {
    return new Promise((resolve, reject) => {
        let pdfName = patientTitle.trim().replace(/ /g, '_') + '_' + userid + '.pdf'
        patientPdf.mv('./public/uploadedfiles/' + pdfName)
        let pdfNewUrl = '/uploadedfiles/' + pdfName
        runQuery(`INSERT INTO patients (title, description, pdfUrl, userid) VALUES
        ('${patientTitle}','${patientDescription}', '${pdfNewUrl}', '${userid}')`).then(result => {
            let saveImgsQuery = ''
            patientImgs.forEach((img, idx) => {
                let ext = img.name.substr(img.name.lastIndexOf('.'))
                let newName = patientTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + ext
                img.mv('./public/uploadedfiles/' + newName)
                const imgUrl = '/uploadedfiles/' + newName
                saveImgsQuery += `INSERT INTO imgs (imgUrl, patientid) VALUES ('${imgUrl}', '${result.insertId}');`
        })
        runQuery(saveImgsQuery).then(() => {
            resolve()
        }).catch(error => {
            reject(error)
        })
        }).catch(error => {
            if (error.erno === 1062) {
                reject(3)
            } else {
                reject(error)
            }
        })
    })
}

function getAllPatients() {
    return new Promise((resolve, reject) => {
        runQuery('SELECT patients.*, imgs.* FROM patients INNER JOIN imgs on patients.id = imgs.patientid').then(results => {
            const patients = []
            results.forEach(result => {
                // search if the patient has been added to patients array
                let patient = patients.find(element => element.id === result.patientid)
                if (patient){
                    // if the patient is added before, we need  only to append the imgs property with the new imgurl
                    patient.imgs.push(result.imgUrl)
                } else {
                    // if the patient is not added to patients, 
                    // we need to add it to patients and set imgs as new array with one element imgurl
                    patients.push({
                        id: result.patientid,
                        title: result.title,
                        description: result.description,
                        pdfUrl: result.pdfUrl,
                        userid: result.userid,
                        imgs: [result.imgUrl]
                    })
                }
            })
            resolve(patients)
        }).catch(error => {
            reject(error)
        })
    })
}

function getPatient(id) {
    return new Promise((resolve, reject) => {
        runQuery(`SELECT patients.* , imgs.* FROM patients INNER JOIN imgs ON imgs.patientid = patients.id WHERE imgs.patientid = ${id}`).then(results => {
            if (results.length) {
                const patient = {}
                results.forEach(result => {
                    if(patient.id) {
                        patient.imgs.push(result.imgUrl)
                    } else {
                        patient.id = result.patientid
                        patient.title = result.title
                        patient.description = result.description
                        patient.pdfUrl = result.pdfUrl
                        patient.userid = result.userid
                        patient.imgs = [result.imgUrl]
                    }
                })
                resolve(patient)
            } else {
                reject(new Error('can not find a patient with this id : ' + id))
            }
        }).catch(error => {
            reject(error)
        })
    })
}

function doctorPatients(userid) {
    return new Promise((resolve, reject) => {
        runQuery(`SELECT patients.*, imgs.* FROM patients INNER JOIN imgs on patients.id = imgs.patientid WHERE patients.userid = ${userid}`).then(results => {
            const patients = []
            results.forEach(result => {
                // search if the patient has been added to patients array
                let patient = patients.find(element => element.id === result.patientid)
                if (patient){
                    // if the patient is added before, we need  only to append the imgs property with the new imgurl
                    patient.imgs.push(result.imgUrl)
                } else {
                    // if the patient is not added to patients, 
                    // we need to add it to patients and set imgs as new array with one element imgurl
                    patients.push({
                        id: result.patientid,
                        title: result.title,
                        description: result.description,
                        pdfUrl: result.pdfUrl,
                        userid: result.userid,
                        imgs: [result.imgUrl]
                    })
                }
            })
            resolve(patients)
        }).catch(error => {
            reject(error)
        })
    })
}

function updatePatient(patientid, newPatientTitle, oldImgsUrls, patientDescription, newPdfPatient, newImgs, userid) {

    return new Promise((resolve, reject) => {
        try {
            (async () => {
                let oldPatientData = await getPatient(patientid)
                const deletedImgs = []
                const keepImgs = []
                
                oldPatientData.imgs.forEach(img => {
                    if (oldImgsUrls.indexOf(img) >= 0 ) {
                        keepImgs.push(img)
                        } else {
                            deletedImgs.push(img)
                        }
                    })
                    // save new images to file system and to array to be saved to db
                let newImgsQuery = ''
                const currentTime = Date.now()
                newImgs.forEach((img, idx) => {
                    const imgExt = img.name.substr(img.name.lastIndexOf('.'))
                    const newImgName = newPatientTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + '_' + currentTime + imgExt
                    //newImgsUrlsArr.push('/uploadedfiles/' + newImgName)
                    const newImgUrl = '/uploadedfiles/' + newImgName
                    newImgsQuery += `INSERT INTO imgs (imgUrl, patientid) VALUES ('${newImgUrl}', ${patientid} );`
                    img.mv('./public/uploadedfiles/' + newImgName)
                    })
                    // delete the deleted images files from the system
                    let deleteImgQuery = ''
                    deletedImgs.forEach(file => {
                    // first check file is exist
                    deleteImgQuery += `DELETE FROM imgs WHERE imgUrl like '${file}' AND patientid = ${patientid};`
                    if (fs.existsSync('./public' + file)) {
                        fs.unlinkSync('./public' + file)
                    }
                    })
                    // check if user upload a new pdf file and move it to the same place of the old one so it will OVERWRITE it
                    if (newPdfPatient) {
                        newPdfPatient.mv('./public' + oldPatientData.pdfUrl)
                    }
                    
                    await runQuery(`UPDATE patients SET title = '${newPatientTitle}', description = '${patientDescription}' WHERE id = ${patientid};` 
                    + deleteImgQuery + newImgsQuery)
                    resolve()                
            })()            
        } catch (error){
            reject(error)
        }
    })
}

function deletePatient(patientid, userid) {
    return new Promise((resolve, reject) => {
        getPatient(patientid).then(patient => {
            // check if the patient belong to the current login user
            if (patient.userid === userid) {
                // delete patient images
                patient.imgs.forEach(img => {
                    //check the img file is exist then delete it
                    if (fs.existsSync('./public' + img)) {
                        fs.unlinkSync('./public' + img)
                    }
                })
                // delete pdf file
                // check if pdf file is exist then delete it
                if (fs.existsSync('./public' + patient.pdfUrl)) {
                    fs.unlinkSync('./public' + patient.pdfUrl)
                }
                    
                    Patients.deleteOne({_id: patientid}).then(() => {
                        resolve()
                    }).catch(error => {
                        reject(error)
                    })
                
            } else {
                reject(new Error('hacking try, not this time'))
            }
        }).catch(error => {
            reject(error)
        })
    })
}

module.exports = {
    registerUser,
    checkUser,
    addPatient,
    getAllPatients,
    getPatient,
    doctorPatients,
    updatePatient,
    deletePatient
}

